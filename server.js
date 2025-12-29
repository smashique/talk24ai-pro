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
        
        // 🎯 AI logic to prevent repetition and follow context
        const masterPrompt = `Role: Professional Male English Mentor.
        Instruction: 
        1. STRICTLY ENGLISH ONLY. No (Teach) or (Review) labels.
        2. CONTEXT: Read the chat history carefully. DO NOT repeat your previous instructions, greetings, or questions. 
        3. SCORING: If user's last message correctly responds to your task, start with [CORRECT]. Otherwise, use [EFFORT].
        4. FLOW: Briefly acknowledge user effort -> teach a tiny new tip -> ask a new situational question.
        5. OPTIONS: Provide 2-3 spoken practice options as a numbered list (1. ..., 2. ...) at the end.
        6. Level: ${mode}.`;

        const historyContext = user.history.slice(-10).map(h => ({ 
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

        let points = rawReply.includes("[CORRECT]") ? 100 : 5;
        let cleanReply = rawReply.replace("[CORRECT]", "").replace("[EFFORT]", "").trim();

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: cleanReply });
        user.lifetime_score += points;
        await user.save();

        res.json({ reply: cleanReply, score_added: points, new_total_score: user.lifetime_score });
    } catch (err) { 
        // 🛠 Descriptive fallback to prevent "Let's keep practicing" loop
        res.json({ reply: "I missed that. Could you say it again? 1. Sure, 2. No problem!", score_added: 0 }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Spoken Lab on ${PORT}`));
