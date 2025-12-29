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
.then(() => console.log("🚀 Spoken Lab Engine Synced!"))
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
        
        const masterPrompt = `Role: Professional Male English Mentor. 
        Instructions:
        1. STRICTLY ENGLISH ONLY. No labels like (Teach), (Review), or [].
        2. Evaluate the user's last message. If it's a correct response to your previous question/task, start your reply with the hidden tag [CORRECT]. If it's incorrect or just a general talk, use [EFFORT].
        3. FLOW: Give natural feedback, teach a tiny tip, and ask a question.
        4. Provide 2-3 numbered options at the end (e.g., 1. Yes, 2. No).
        5. Mode: ${mode}.`;

        const historyContext = user.history.slice(-10).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, ...historyContext, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}` } });

        let result = JSON.parse(response.data.choices[0].message.content);
        let replyText = result.reply;
        
        // Scoring Logic: Correct = 100, Effort/Wrong = 5
        let points = replyText.includes("[CORRECT]") ? 100 : 5;
        let cleanReply = replyText.replace("[CORRECT]", "").replace("[EFFORT]", "").trim();

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: cleanReply });
        user.lifetime_score += points;
        await user.save();

        res.json({ reply: cleanReply, score_added: points, new_total_score: user.lifetime_score });
    } catch (err) { 
        res.json({ reply: "Let's continue our practice! 1. Yes! 2. Sure!", score_added: 0 }); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
