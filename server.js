const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 OPTIMIZED DB CONNECTION
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log("✅ Database Synced & Ready for Speed!"))
.catch(err => console.error("❌ DB Sync Failed:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    total_msgs: { type: Number, default: 0 },
    lifetime_score: { type: Number, default: 0 },
    total_time: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const cleanUnicode = (str) => String(str).replace(/\\u[\dA-F]{4}/gi, (m) => String.fromCharCode(parseInt(m.replace(/\\u/g, ''), 16)));

const CURRICULUM = {
    'A': 'Nouns & Greetings', 'B': 'Action Verbs & Articles',
    'C': 'Adjectives & Pronouns', 'D': 'Tenses & Connectors', 'E': 'Idioms & Phrasal Verbs'
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userLevel = skillMatch ? skillMatch[1] : 'A';
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const isStart = message === "Action!";
        if (isStart) user.history = [];
        else user.total_msgs += 1;

        const currentFocus = CURRICULUM[userLevel];
        const historyText = user.history.slice(-4).map(h => `${h.role}:${h.content}`).join("\n");

        // ⚡ STREAMLINED TURBO PROMPT
        const turboPrompt = `Role:World-class English Mentor & Muslim. Use ONLY English.
        Focus:${currentFocus}. 
        Rules:1. No echo user. 2. Start unique roleplay if NEW. 3. +10 XP ONLY if relevant & uses ${currentFocus}.
        Mentor Format(3 bullets):
        • Review: Feedback on ${currentFocus}.
        • Tip: Grammar insight.
        • Next Step: Strategy.
        History:${historyText}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: turboPrompt }, { role: "user", content: isStart ? "Start scenario." : message }],
            model: "llama-3.1-8b-instant", // Fastest model available
            temperature: 0.6,
            response_format: { type: "json_object" }
        }, { 
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` },
            timeout: 22000 // Cut off before Render's 30s limit
        });

        let result = JSON.parse(response.data.choices[0].message.content);

        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 8) user.history = user.history.slice(-8);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        await user.save();

        res.json({ reply: cleanUnicode(result.conversation), instruction: cleanUnicode(result.learning_note), score_added: result.score_added || 0, new_total_score: user.lifetime_score });

    } catch (err) {
        res.json({ 
            reply: "The connection is a bit slow. Could you please repeat that?", 
            instruction: "• Review: System latency detected.\\n• Tip: Use short sentences during high traffic.\\n• Next Step: Try repeating your input." 
        });
    }
});

app.post('/api/stats', async (req, res) => {
    const user = await User.findOne({ userId: req.body.userId });
    if (user) res.json({ total: user.total_msgs, score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1, lifetime_seconds: user.total_time });
    else res.json({ total:0, score:0, level:1, lifetime_seconds:0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Turbo Engine running on ${PORT}`));
