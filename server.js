const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express(); // ✅ ডেপ্লয়মেন্ট ফিক্স: app এখন শুরুতেই ডিফাইন করা
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Engine Live & Optimized!"))
.catch(err => console.error("❌ DB Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    speak_streak: { type: Number, default: 0 },
    last_speak_date: { type: String, default: "" },
    history: [{ role: String, content: String }]
}));

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId, inputType } = req.body; 
    const isStart = !!message.match(/Mission Start:/) || message === "Action!";

    try {
        let user = await User.findOne({ userId }) || new User({ userId });
        if (isStart) user.history = [];

        // 🔥 SPEED OPTIMIZED PROMPT
        const masterPrompt = `Role:Character Mentor. Identity:Muslim English Mentor (Use Salam). 
        Task:Talk about the topic. Rules:STRICTLY ONLY English. No repetitive options.
        Format:Return JSON {"reply":"Dialog + Question + [A. Option 1 | B. Option 2]", "perf":"Assess String", "note":"Feedback", "xp":10}. 
        ⚠️Options MUST be in brackets at the very end of "reply".`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.6,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 15000 });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 20 : 10;

        user.history.push({ role: 'User', content: message }, { role: 'Actor', content: result.reply });
        if (!isStart) user.lifetime_score += points;
        await user.save();

        res.json({ reply: result.reply, performance: result.perf, notes: result.note, score_added: points, new_total_score: user.lifetime_score, streak: user.speak_streak });
    } catch (err) { res.json({ reply: "My system is re-syncing! [A. Retry | B. Okay]" }); }
});

app.post('/api/stats', async (req, res) => {
    const user = await User.findOne({ userId: req.body.userId });
    res.json({ score: user ? user.lifetime_score : 0, level: user ? Math.floor(user.lifetime_score/1000)+1 : 1, streak: user ? user.speak_streak : 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Mastery Engine running on ${PORT}`));
