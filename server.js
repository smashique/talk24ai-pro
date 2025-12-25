const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Assessment Engine Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const SYLLABUS = {
    'A': { name: "Beginner", age: "6-10", goal: "Basic Needs" },
    'B': { name: "Learner", age: "10-16", goal: "Routine Fluency" },
    'C': { name: "Hesitant", age: "17-24", goal: "Opinion & IELTS" },
    'D': { name: "Professional", age: "24-34", goal: "Corporate Leadership" }
};

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

        // 🧠 STRICT ASSESSMENT PROMPT
        const masterPrompt = `
        [IDENTITY] Proactive English Mentor & Actor. Muslim. ONLY English.
        
        [IMMERSIVE ROLE]
        Act as: ${currentTopic === "General Practice" ? "A friendly guide" : "Character for " + currentTopic}.
        Roleplay MUST be situational. No teacher tone.
        
        [INTERACTIVE PROTOCOL]
        1. CONVERSATION: One human reply + Engaging question.
        2. CHOICE BUTTONS: At the end, provide exactly 2 short options like: [A. Option 1 | B. Option 2].
        3. ASSESSMENT: Evaluate the user's input "${message}" out of 100 for Fluency, Grammar, and Vocab.

        [JSON OUTPUT]
        {
          "reply": "Character response + Question + [A. ... | B. ...]",
          "performance": "Fluency: X | Grammar: Y | Vocab: Z | Status: Growing",
          "notes": "• Review: Feedback\\n• Tip: A quick hack\\n• Next: Mission Target",
          "xp": 5-20
        }
        
        History Context:\n${historyContext}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? `Start: ${currentTopic}` : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.reply });
        
        const addedXP = result.xp || 10;
        if (!isStart) user.lifetime_score += addedXP;
        await user.save();

        res.json({ 
            reply: result.reply, 
            instruction: result.performance + "\\n" + result.notes, 
            score_added: addedXP, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { res.json({ reply: "Magic link syncing. Try again, buddy!", instruction: "System: Assessment Sync." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        res.json({ score: user ? user.lifetime_score : 0, level: user ? Math.floor(user.lifetime_score/1000)+1 : 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Mastery Engine v7 running on ${PORT}`));
