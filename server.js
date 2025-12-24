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
    'A': { age: "6-10", name: "Beginner", focus: "TPR & Imagination", tone: "Magic, Exciting, Cheerful" },
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
        
        // 💾 PERSISTENCE LOGIC: Fetch context even if "Action!" is clicked
        const lastTurn = user.history.length > 0 ? user.history[user.history.length - 1].content : "First time starting.";
        const contextHistory = user.history.slice(-8).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 HYPER-ENGAGEMENT & ADDICTION PROMPT
        const masterPrompt = `
        [IDENTITY] World-class Proactive English Specialist & Practicing Muslim.
        [VALUES] Use Islamic Akhlaq (Salam/JazakAllah) naturally.
        [STRICT RULE] Speak ONLY in English. NO HALLUCINATIONS: Never mention pictures or looking at a screen. Use imagination.

        [ADDICTION & ENGAGEMENT ALGORITHM]
        1. THE SOCRATIC HOOK: Never finish a sentence without a question. Every reply MUST end with ONE high-engagement question.
        2. HERO'S JOURNEY: Every level (${currentLevel}) is a mission. (e.g., Track A: "Lost in a candy forest", Track E: "Saving a global company").
        3. SCAFFOLDING: Build on the user's last message: "${lastTurn}". Acknowledge their effort before moving to the next mission step.
        4. VARIABLE REWARDS: Grant points (5-20) in "score_added" based on sentence complexity and grammar usage.
        5. NO ECHO: Move the plot forward. Do not repeat what the user said.

        [MISSION DETAILS]
        - Track: ${trackInfo.name} (${trackInfo.age} yrs) | Focus: ${trackInfo.focus}.
        - Roleplay Tone: ${trackInfo.tone}.

        [JSON OUTPUT]
        {
          "conversation": "Proactive character response + Mission Progress + Engaging Question",
          "learning_note": "• Review: Feedback on grammar\\n• Tip: A quick English hack\\n• Next: Hidden milestone",
          "score_added": 5-20
        }
        
        History Context:\n${contextHistory}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? "Action! Resume or start my adventure mission." : message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.8,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        // 💾 PERSISTENT HISTORY UPDATE
        if (isStart && user.history.length === 0) {
            user.history.push({ role: 'User', content: "Started Adventure" });
        } else {
            user.history.push({ role: 'User', content: message });
        }
        user.history.push({ role: 'Actor', content: result.conversation });
        
        // Keep 12 messages for deep context
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
        console.error("Mastery Engine Error:", err.message);
        res.json({ reply: "My connection is blinking. Let's stay in the mission! Try again?", instruction: "• Note: System sync in progress." }); 
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
app.listen(PORT, () => console.log(`🚀 Addiction Engine v4 (Engaging Mode) running on ${PORT}`));
