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
.then(() => console.log("🚀 Talk24AI Addiction Engine Synced!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const ACADEMY_METADATA = {
    'A': { age: "6-10", name: "Beginner", focus: "TPR & Imagination", tone: "Exciting, Magic, Cheerful" },
    'B': { age: "10-16", name: "Learner", focus: "Routines & Action", tone: "Cool, High-energy, Friendly" },
    'C': { age: "17-24", name: "Hesitant", focus: "Opinion & Logic", tone: "Empathetic, Chill, Supportive" },
    'D': { age: "17-24", name: "IELTS/GRE", focus: "Structure & Academic Flow", tone: "Strict, Sophisticated, Formal" },
    'E': { age: "24-34", name: "Professional", focus: "Authority & Leadership", tone: "Executive, Assertive, Sharp" }
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-E])/) ? systemInstruction.match(/Skill Level: ([A-E])/)[1] : 'A';
    const isStart = message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const trackInfo = ACADEMY_METADATA[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1;
        
        // 💾 SERVER-SIDE PERSISTENCE (Last message logic)
        if (isStart) user.history = [];
        const lastMsgContext = user.history.length > 0 ? user.history[user.history.length-1].content : "No previous data.";

        // 🧠 META-ADDICTION + CHATGPT EXPERT PROMPT
        const masterPrompt = `
        [IDENTITY] World-class Proactive English Mentor & Muslim.
        [TONE] ${trackInfo.tone}. Use Akhlaq (Salam/JazakAllah) naturally.
        
        [ADDICTION PROTOCOL - TOP SECRET]
        1. VARIABLE XP: Based on user effort, recommend points between 5-20 in "score_added".
        2. DYNAMIC STORYTELLING: Don't just talk. Turn the session into a MISSION for level ${currentLevel}. (e.g., "We are astronauts landing on Mars...").
        3. MULTI-LAYERED QUESTIONS: Ask an engaging question that connects to their LAST message: "${lastMsgContext}".
        4. NEVER FREEZE: If user is stuck, offer a "Magic Clue" (A or B choice).
        5. STRICT: ONLY English. No pictures. Use imagination.

        [ACADEMIC MISSION]
        Track: ${trackInfo.name} | Target Age: ${trackInfo.age} | Focus: ${trackInfo.focus}.

        [JSON FORMAT]
        {
          "conversation": "Proactive character reply + New Mission Step + One High-Engagement Question",
          "learning_note": "• Review: Feedback\\n• Tip: Meta-learning shortcut\\n• Next: Hidden Achievement",
          "score_added": 5-20
        }
        
        History Context (Keep it flowing):\n${user.history.slice(-6).map(h => `${h.role}: ${h.content}`).join("\n")}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? "Action! Start my adventure." : message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.85, // Meta-expert recommended higher creativity
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        // 💾 SAVE HISTORY ON SERVER (Strictly maintained)
        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 12) user.history = user.history.slice(-12);
        
        if (!isStart) user.lifetime_score += (result.score_added || 10);
        await user.save();

        res.json({ 
            reply: result.conversation, 
            instruction: result.learning_note, 
            score_added: result.score_added || 10, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { 
        res.json({ reply: "Our Magic Connection is blinking! Let's try again.", instruction: "• Note: Server Sync." }); 
    }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
        else res.json({ score: 0, level: 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Addiction Engine v4 (Meta Logic) running on ${PORT}`));
