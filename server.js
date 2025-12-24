const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 PERSISTENT DB CONNECTION
const MONGO_URI = process.env.MONGO_URI; 
mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Persistent Database Connected!"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// 📂 USER DATA SCHEMA
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

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', async (req, res) => {
    const { userId, seconds } = req.body;
    try { await User.findOneAndUpdate({ userId }, { $inc: { total_time: seconds } }); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// 💬 API: CHAT (PRE-DETERMINED CURRICULUM ENGINE)
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

        // 📘 PRE-DETERMINED CURRICULUM CONTENT
        const CURRICULUM = {
            'A': { title: 'Nouns & Greetings', description: 'Naming people, objects, and basic social greetings.' },
            'B': { title: 'Action Verbs & Articles', description: 'Using common verbs and a, an, the correctly.' },
            'C': { title: 'Adjectives & Pronouns', description: 'Describing attributes and replacing nouns.' },
            'D': { title: 'Tenses & Connectors', description: 'Mastering time flow and sentence linkers.' },
            'E': { title: 'Idioms & Phrasal Verbs', description: 'Natural professional expressions and idioms.' }
        };

        const currentSyllabus = CURRICULUM[userLevel];
        const contextHistory = user.history.slice(-6).map(h => `${h.role}: "${h.content}"`).join("\n");

        const masteryPrompt = `
        [MASTER ROLE] World-class English Specialist & practicing Muslim. Speak ONLY English.
        [FIXED CURRICULUM] Level ${userLevel} Focus: **${currentSyllabus.title}**.
        [GOAL] Subconsciously teach ${currentSyllabus.description} through the roleplay.

        [PROTOCOLS]
        1. NO ECHOING: Never repeat what the user said.
        2. INFINITE SCENARIO: Generate a unique scenario suitable for this skill level at start.
        3. STRICT SCORING: Give 10 XP ONLY if the reply is Relevant AND uses "${currentSyllabus.title}" correctly.
        4. ISLAMIC AKHLAQ: Use polite manners and Islamic greetings naturally.

        [MENTOR STRUCTURE - 3 BULLETS ONLY]
        • Review: Feedback on your grammar and specifically your use of **${currentSyllabus.title}**.
        • Skill Tip: A professional insight into why "${currentSyllabus.title}" is important here.
        • Next Step: Guidance for your next move without giving the answer.

        [SESSION DATA]
        - Level: ${userLevel} | Skill Focus: ${currentSyllabus.title}
        - History: ${contextHistory}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masteryPrompt }, { role: "user", content: isStart ? "Start simulation now. Introduce the scenario and my goal." : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        let result = JSON.parse(response.data.choices[0].message.content);

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

    } catch (err) { res.json({ reply: "I'm sorry, I missed that. Please repeat.", instruction: "• Review: Connection timeout. \\n• Tip: Be brief. \\n• Next Step: Repeat your last input." }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Persistent Curriculum Engine running on port ${PORT}`));
