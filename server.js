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
.then(() => console.log("🚀 Talk24AI 2X XP Engine Connected!"))
.catch(err => console.error("❌ DB Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
}));

app.post('/api/chat', async (req, res) => {
    // inputType: 'click' (বাটন ক্লিক) অথবা 'voice' (মাইক্রোফোন)
    let { message, systemInstruction, userId, inputType } = req.body; 
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Practice";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });
        if (isStart) user.history = [];

        const historyContext = user.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");

        const masterPrompt = `
        [IDENTITY] Proactive English Mentor. Muslim.
        [ROLE] Character for: ${currentTopic}. 
        
        [STRICT JSON FORMAT]
        {
          "reply": "Character message + [A. Option 1 | B. Option 2]",
          "performance": "Fluency: X% | Grammar: Y% | Vocab: Z% | Status: ...",
          "notes": "Mentoring feedback + Points hint",
          "base_xp": 10
        }`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? `Start: ${currentTopic}` : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);
        
        // 💰 REWARD CALCULATION
        let pointsEarned = result.base_xp || 10;
        if (inputType === 'voice') pointsEarned *= 2; // মুখে বললে ২০ পয়েন্ট, ক্লিক করলে ১০ পয়েন্ট

        user.history.push({ role: 'User', content: message }, { role: 'Actor', content: result.reply });
        if (!isStart) user.lifetime_score += pointsEarned;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.performance, 
            notes: result.notes, 
            score_added: pointsEarned, 
            new_total_score: user.lifetime_score,
            is_bonus: inputType === 'voice' 
        });
    } catch (err) { res.json({ reply: "Connection blink! Let's try again.", performance: "Syncing...", notes: "Re-syncing data." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        res.json({ score: user ? user.lifetime_score : 0, level: user ? Math.floor(user.lifetime_score/1000)+1 : 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

app.listen(3000, () => console.log(`🚀 Mastery Engine (2X XP) running on 3000`));
