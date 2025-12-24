const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION (Persistent Device ID Storage)
const MONGO_URI = process.env.MONGO_URI; 
mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Talk24AI Database Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

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

// 📊 API: STATS
app.post('/api/stats', async (req, res) => {
    const { userId } = req.body;
    try {
        let user = await User.findOne({ userId });
        if (!user) { user = new User({ userId }); await user.save(); }
        const level = Math.floor(user.lifetime_score / 1000) + 1;
        res.json({ total: user.total_msgs, score: user.lifetime_score, level, lifetime_seconds: user.total_time });
    } catch (err) { res.status(500).json({ error: "Database Fetch Error" }); }
});

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', async (req, res) => {
    const { userId, seconds } = req.body;
    try {
        await User.findOneAndUpdate({ userId }, { $inc: { total_time: seconds } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Time update failed" }); }
});

// 💬 API: CHAT (INFINITE SCENARIO ENGINE)
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

        // Dynamic context building for AI
        const contextHistory = user.history.slice(-6).map(h => `${h.role}: "${h.content}"`).join("\n");

        // 🧠 UNLIMITED SCENARIO MASTER PROMPT
        const masterPrompt = `
        [MASTER ROLE] World-class English Specialist & practicing Muslim. Speak ONLY English.
        
        [UNLIMITED SCENARIO PROTOCOL]
        - IF THIS IS THE START: You must creatively GENERATE a unique and logical scenario for the user based on their level (${userLevel}).
        - Categorize by Age: Levels A/B = Kids Themes (Adventure, Zoo, Space, Toys). Levels C/D/E = Adult Themes (Career, Travel, Technology, Life Skills).
        - Role Setup: Clearly define who the Actor is and who the User is. Tell the User their mission goal at the beginning.
        
        [STRICT RULES]
        1. PERSISTENCE: Device User ID ${userId} is fixed in the database.
        2. NO ECHO: Actor must never repeat the user's words. Be a real human.
        3. MENTOR STRUCTURE: Exactly 3 English bullet points (Review, Tip, Instruction).
        4. ISLAMIC AKHLAQ: Subconsciously teach moral values through polite conversation (Assalamu Alaikum, Alhamdulillah).

        [SESSION MEMORY]
        ${contextHistory || "New session starting."}

        [OUTPUT JSON FORMAT]
        {
            "conversation": "Actor's English reply (or scenario intro if starting)",
            "learning_note": "• Review: ... \\n• Tip: ... \\n• Next Step: ...",
            "score_added": 10 or 0
        }`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? "Action! Generate a unique scenario and start." : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.8, // Slightly higher for creativity in scenarios
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        let result = JSON.parse(response.data.choices[0].message.content);

        // Save to Persistent History
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
        console.error("Mastery Engine Error:", err.message);
        res.json({ 
            reply: "I'm sorry, I'm having a little trouble connecting. Could you please say that again?", 
            instruction: "• Review: Connection issue encountered.\\n• Tip: Check your internet stability.\\n• Next Step: Try repeating your last message." 
        }); 
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB(); // Fallback for visibility
    let html = `<html><head><title>Admin Stats</title></head><body><h1>User Metrics</h1><p>Visit MongoDB Atlas for real-time data persistence.</p></body></html>`;
    res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Infinite Mastery Engine running on port ${PORT}`));
