const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express(); 
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Engine Optimized!"))
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
    const currentTopic = message.match(/Mission Start: (.+)/)?.[1] || "General Practice";
    const isStart = !!message.match(/Mission Start:/) || message === "Action!";

    try {
        let user = await User.findOne({ userId }) || new User({ userId });
        if (isStart) user.history = [];

        // 🔥 SPEED STREAK LOGIC
        if (inputType === 'voice') {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (user.last_speak_date !== today) {
                user.speak_streak = (user.last_speak_date === yesterdayStr) ? user.speak_streak + 1 : 1;
                user.last_speak_date = today;
            }
        }

        const historyContext = user.history.slice(-6).map(h => `${h.role}:${h.content}`).join("\n");

        // 🧠 LEAN MASTER PROMPT (Faster Inference)
        const masterPrompt = `Role:Character for "${currentTopic}". Identity:Proactive Muslim English Mentor. Use Salam. 
        Rules:Strictly ONLY English. Keep it situational. No teacher tone.
        Format:Return JSON {"reply":"Dialog + Question + [A. Option 1 | B. Option 2]", "perf":"Fluency:X%|Grammar:Y%|Status:Z", "note":"Feedback", "xp":10}. 
        ⚠️Options MUST be in brackets at end of "reply".`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.6, // Lower temperature for faster & consistent output
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 15000 });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 20 : 10;

        user.history.push({ role: 'User', content: message }, { role: 'Actor', content: result.reply });
        if (!isStart) user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.perf, 
            notes: result.note, 
            score_added: points, 
            new_total_score: user.lifetime_score,
            streak: user.speak_streak 
        });
    } catch (err) { res.json({ reply: "My system is catching its breath! Let's try again. [A. Sure! | B. Okay]", performance: "Syncing...", notes: "Network lag." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        res.json({ score: user ? user.lifetime_score : 0, level: user ? Math.floor(user.lifetime_score/1000)+1 : 1, streak: user ? user.speak_streak : 0 });
    } catch(e) { res.json({ score: 0, level: 1, streak: 0 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Optimized Mastery Engine on ${PORT}`));
