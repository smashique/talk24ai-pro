const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express(); // ✅ Fixed ReferenceError
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Engine Synced!"))
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
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Practice";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });
        if (isStart) user.history = [];

        // 🔥 STREAK LOGIC
        if (inputType === 'voice') {
            const today = new Date().toISOString().split('T')[0];
            if (user.last_speak_date !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                user.speak_streak = (user.last_speak_date === yesterdayStr) ? user.speak_streak + 1 : 1;
                user.last_speak_date = today;
            }
        }

        const historyContext = user.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");

        const masterPrompt = `
        [IDENTITY] World-class Proactive English Mentor. Muslim.
        [TASK] Act as character for topic: "${currentTopic}". 
        [STRICT RULE] Use Salaam and Islamic Akhlaq. ONLY English.
        
        [STRICT OUTPUT FORMAT]
        Return a JSON object:
        1. "reply": Character dialogue ending with a question + [A. Option 1 | B. Option 2].
        2. "performance": Assessment STRING (Example: "Fluency: 85% | Grammar: 80% | Status: Growing"). 
           ⚠️ MUST BE A STRING to avoid [object Object] error.
        3. "notes": Mentoring feedback (Review, Tip, Next).
        4. "xp": Number 10.

        History:\n${historyContext}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? `Start: ${currentTopic}` : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? (result.xp || 10) * 2 : (result.xp || 10);

        user.history.push({ role: 'User', content: message }, { role: 'Actor', content: result.reply });
        if (!isStart) user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.performance, // ✅ Always string
            notes: result.notes, 
            score_added: points, 
            new_total_score: user.lifetime_score,
            streak: user.speak_streak 
        });
    } catch (err) { res.json({ reply: "Connection blink! Say it again? [A. Sure! | B. Okay]", performance: "Syncing...", notes: "Re-syncing." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        res.json({ score: user ? user.lifetime_score : 0, level: user ? Math.floor(user.lifetime_score/1000)+1 : 1, streak: user ? user.speak_streak : 0 });
    } catch(e) { res.json({ score: 0, level: 1, streak: 0 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Mastery Engine running on ${PORT}`));
