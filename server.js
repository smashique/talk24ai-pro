const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION (Persistent Mastery Storage)
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Global Academy DB Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

// 📘 THE UNIVERSAL SYLLABUS METADATA (Cross-checked with Global Methodologists)
const ACADEMY_METADATA = {
    'A': { age: "6-10", name: "Beginner", focus: "TPR & Functional Naming", tone: "Magic, Encouraging, Fun", goal: "Foundation & Confidence" },
    'B': { age: "10-16", name: "Learner", focus: "Communicative Competence & Routines", tone: "Dynamic, Youthful, Engaging", goal: "Daily Fluency" },
    'C': { age: "17-24", name: "Hesitant", focus: "Cognitive Confidence & Opinion Flow", tone: "Empathetic, Supportive, Relaxed", goal: "Social Conversationalist" },
    'D': { age: "17-24", name: "IELTS/GRE", focus: "Rubric-based Logic & Connectors", tone: "Analytical, Formal, Structured", goal: "Academic Excellence" },
    'E': { age: "24-34", name: "Professional", focus: "ESP (Specific Purposes) & Leadership Tone", tone: "Corporate, Assertive, Polished", goal: "Career Authority" }
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-E])/) ? systemInstruction.match(/Skill Level: ([A-E])/)[1] : 'A';
    const isStart = message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const trackInfo = ACADEMY_METADATA[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1; // Logic: 1000 XP per level
        
        if (isStart) user.history = [];
        const context = user.history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 GLOBAL EXPERTS + PSYCHOLOGY DRIVEN PROMPT
        const masterPrompt = `
        [IDENTITY] World-class Global English Specialist (Methodology Focus).
        [VALUES] Practicing Muslim. Use polite manners (Akhlaq) naturally.
        [ALL ENGLISH] Speak ONLY English.

        [TRACK ARCHITECTURE]
        - Current Track: ${trackInfo.name} | Target Age: ${trackInfo.age}.
        - Mastery Level: ${currentLevel} of 100.
        - Pedagogy Focus: ${trackInfo.focus}.
        - Psychology Tone: ${trackInfo.tone}.
        
        [STRICT INSTRUCTIONS]
        1. START PROTOCOL: Greet warmly (Salam), state the Level ${currentLevel} "Achievement Badge" name, and briefly explain the mission goal based on age ${trackInfo.age}.
        2. ROLEPLAY: Create a task-based scenario suitable for age ${trackInfo.age}.
        3. NO ECHO: Never repeat user's words. Move the conversation forward humanly.
        4. MENTOR FEEDBACK: Use "Sandwich Feedback" (Praise -> Correction -> Next Step). Focus on "${trackInfo.focus}".
        5. SCORING: Award +10 XP ONLY if the response shows context relevance and growth in ${trackInfo.focus}.

        [JSON OUTPUT FORMAT]
        {
          "conversation": "Actor's age-appropriate response",
          "learning_note": "• Review: Feedback on ${trackInfo.focus}\\n• Tip: Global methodology insight\\n• Next Step: Strategic move",
          "score_added": 10 or 0
        }
        
        History: ${context}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? "Action! Begin simulation." : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 20000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        // Persistent Progress Save
        user.history.push({ role: 'User', content: isStart ? "Session Started" : message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 8) user.history = user.history.slice(-8);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        
        await user.save();

        res.json({ 
            reply: result.conversation, 
            instruction: result.learning_note, 
            score_added: result.score_added, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { res.json({ reply: "Connection is stabilizing. Please try again.", instruction: "• Note: System sync in progress." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
        else res.json({ score: 0, level: 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Global Multi-Track Academy running on port ${PORT}`));
