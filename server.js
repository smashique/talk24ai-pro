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
.then(() => console.log("🚀 Talk24AI Engine Connected!"))
.catch(err => console.error("❌ DB Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
}));

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Practice";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });
        if (isStart) user.history = [];

        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1;
        const historyContext = user.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");

        const masterPrompt = `
        [IDENTITY] Proactive English Mentor & Actor. Muslim. Speak ONLY English.
        [ROLE] Become character for: ${currentTopic}. Use immersive situational dialogue.
        
        [STRICT RESPONSE FORMAT]
        You MUST return JSON with:
        1. "reply": A character message ending with a question + exactly 2 options in format [A. Option 1 | B. Option 2].
        2. "performance": Assessment of user's last input: "${message}" (Fluency: X% | Grammar: Y% | Vocab: Z% | Status: ...).
        3. "notes": Mentoring feedback (Review, Tip, Next Step).
        4. "xp": Score between 5-20 based on effort.

        History:\n${historyContext}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? `Start: ${currentTopic}` : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);
        user.history.push({ role: 'User', content: message }, { role: 'Actor', content: result.reply });
        if (!isStart) user.lifetime_score += (result.xp || 10);
        await user.save();

        res.json({ reply: result.reply, performance: result.performance, notes: result.notes, score_added: result.xp || 10, new_total_score: user.lifetime_score });
    } catch (err) { res.json({ reply: "Magic link syncing. Try again!", performance: "Syncing...", notes: "System update." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        res.json({ score: user ? user.lifetime_score : 0, level: user ? Math.floor(user.lifetime_score/1000)+1 : 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

app.listen(3000, () => console.log(`🚀 Mastery Engine running on 3000`));
