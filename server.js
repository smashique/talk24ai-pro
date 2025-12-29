const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || '', { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Engine Synced!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
}));

app.post('/api/chat', async (req, res) => {
    let { message, userId, mode } = req.body; 
    try {
        let user = await User.findOne({ userId }) || new User({ userId });
        
        // 🎯 Professional Prompt Logic
        const masterPrompt = `Role: Professional Male English Mentor.
        Instructions:
        1. STRICTLY ENGLISH ONLY. No (Teach) or (Review) labels.
        2. Evaluate the user's input: if they followed your previous task correctly, include [CORRECT] at the start. Otherwise, include [EFFORT].
        3. FLOW: Give natural feedback -> teach a tiny tip -> ask a situational quiz/question.
        4. List 2-3 spoken practice options at the end (e.g., 1. Option A, 2. Option B).
        5. Current Level: ${mode}. Use vocabulary suited for this level.
        6. DO NOT repeat greetings or previous messages. Continue the conversation flow.`;

        const historyContext = user.history.slice(-8).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, ...historyContext, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        let rawReply = result.reply;

        // 🏆 Scoring: Correct=100, Effort=5
        let points = rawReply.includes("[CORRECT]") ? 100 : 5;
        let cleanReply = rawReply.replace("[CORRECT]", "").replace("[EFFORT]", "").trim();

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: cleanReply });
        user.lifetime_score += points;
        await user.save();

        res.json({ reply: cleanReply, score_added: points, new_total_score: user.lifetime_score });
    } catch (err) { 
        res.json({ reply: "Let's keep practicing! 1. Yes, I'm ready! 2. Sure!", score_added: 0 }); 
    }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Spoken Lab running on ${PORT}`));
