const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 OPTIMIZED PERSISTENT DB CONNECTION
const MONGO_URI = process.env.MONGO_URI; 
mongoose.connect(MONGO_URI, {
    maxPoolSize: 10, // Maintain a pool of connections for speed
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log("🚀 Talk24AI DB Connected & Pooled!"))
.catch(err => console.error("❌ DB Connection Error:", err));

// 📂 USER SCHEMA
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    total_msgs: { type: Number, default: 0 },
    lifetime_score: { type: Number, default: 0 },
    total_time: { type: Number, default: 0 },
    current_skill: { type: String, default: 'A' },
    history: [{ role: String, content: String }]
});

const User = mongoose.model('User', userSchema);

// 🛡️ UTILS
const cleanUnicode = (str) => String(str).replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
const sanitizeInput = (text) => String(text).replace(/<[^>]*>?/gm, '').trim();

// 📘 PRE-DETERMINED CURRICULUM
const CURRICULUM = {
    'A': { title: 'Nouns & Greetings', focus: 'Naming objects and initial social greetings.' },
    'B': { title: 'Action Verbs & Articles', focus: 'Using common verbs and a, an, the correctly.' },
    'C': { title: 'Adjectives & Pronouns', focus: 'Describing attributes and replacing nouns.' },
    'D': { title: 'Tenses & Connectors', focus: 'Mastering time flow and logical sentence linkers.' },
    'E': { title: 'Idioms & Phrasal Verbs', focus: 'Natural professional expressions and native idioms.' }
};

// 💬 API: CHAT (HIGH-SPEED ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userLevel = skillMatch ? skillMatch[1] : 'A';
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId, current_skill: userLevel });

        const isStart = message === "Action!";
        if (isStart) user.history = [];
        else user.total_msgs += 1;

        const currentSyllabus = CURRICULUM[userLevel];
        const contextHistory = user.history.slice(-6).map(h => `${h.role}: "${h.content}"`).join("\n");

        const masteryPrompt = `
        [IDENTITY] World-class English Specialist & practicing Muslim. Speak ONLY English.
        [GOAL] Teach ${currentSyllabus.title} via roleplay.
        [RULES]
        1. NO ECHO: Do not repeat user input.
        2. DYNAMIC SCENARIO: Create a unique roleplay for Level ${userLevel} at start.
        3. SCORE: Give 10 XP ONLY if relevant and uses ${currentSyllabus.title} correctly.
        4. STRUCTURE (3 Bullets):
           • Review: Feedback on ${currentSyllabus.title}.
           • Tip: Insight on current skill.
           • Instruction: Next move guide.
        [CONTEXT] Focus: ${currentSyllabus.title}. History: ${contextHistory}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masteryPrompt },
                { role: "user", content: isStart ? "Action! Begin scenario." : message }
            ],
            model: "llama-3.1-8b-instant", // High-speed model to prevent hangs
            temperature: 0.6,
            response_format: { type: "json_object" }
        }, { 
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` },
            timeout: 22000 // Internal timeout before Render's 30s limit
        });

        let result = JSON.parse(response.data.choices[0].message.content);

        // Update Persistence
        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 10) user.history = user.history.slice(-10);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        
        await user.save();

        res.json({ 
            reply: cleanUnicode(result.conversation), 
            instruction: cleanUnicode(result.learning_note),
            score_added: result.score_added || 0,
            new_total_score: user.lifetime_score
        });

    } catch (err) { 
        console.error("Mastery Hang Fix Error:", err.message);
        res.json({ 
            reply: "I'm sorry, the connection is slow. Could you try again?", 
            instruction: "• Review: Connection timeout.\\n• Tip: Be brief.\\n• Next Step: Repeat your last input." 
        }); 
    }
});

// 📊 API: STATS
app.post('/api/stats', async (req, res) => {
    const { userId } = req.body;
    try {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId }); await user.save(); }
        const level = Math.floor(user.lifetime_score / 1000) + 1;
        res.json({ total: user.total_msgs, score: user.lifetime_score, level, lifetime_seconds: user.total_time });
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 High-Speed persistent Engine running on port ${PORT}`));
