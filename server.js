const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express(); // ✅ ডেপ্লয়মেন্ট এরর ফিক্স করতে এই লাইনটি নিশ্চিত করা হয়েছে
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION (Expert Persistence Logic)
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Value-Driven Engine Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    speak_streak: { type: Number, default: 0 },
    last_speak_date: { type: String, default: "" },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

// 🎯 API: Chat Interface with Double XP & Streak Logic
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId, inputType } = req.body; 
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    
    // Mission detection
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Practice";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        if (isStart) user.history = [];

        // 🔥 STREAK LOGIC (Daily Engagement Booster)
        if (inputType === 'voice') {
            const today = new Date().toISOString().split('T')[0];
            if (user.last_speak_date !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                // If they spoke yesterday, increment streak; otherwise reset to 1
                user.speak_streak = (user.last_speak_date === yesterdayStr) ? user.speak_streak + 1 : 1;
                user.last_speak_date = today;
            }
        }

        const historyContext = user.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 THE EXPERT MASTER PROMPT (With Islamic Rulings & String Assessment)
        const masterPrompt = `
        [IDENTITY] World-class Proactive English Mentor. Practicing Muslim.
        [VALUES] Use "Assalamu alaikum" and "JazakAllah" naturally. Maintain Islamic Akhlaq.
        [TASK] Act as a character for topic: "${currentTopic}". 

        [STRICT OUTPUT FORMAT]
        You MUST return a JSON object with:
        1. "reply": Character-locked dialogue ending with a question + [A. Option 1 | B. Option 2].
        2. "performance": Assessment STRING ONLY (Example: "Fluency: 80% | Grammar: 75% | Status: Growing"). 
           ⚠️ DO NOT return an object for this field to avoid [object Object] errors.
        3. "notes": Mentoring feedback (Review, Tip, Next).
        4. "xp": Base score number between 5-20.

        History Context:\n${historyContext}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? `Start Mission: ${currentTopic}` : message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        // 💰 REWARD LOGIC: 2X XP for Voice
        let pointsEarned = result.xp || 10;
        if (inputType === 'voice') pointsEarned *= 2; 

        // Update database
        user.history.push({ role: 'User', content: message }, { role: 'Actor', content: result.reply });
        if (user.history.length > 20) user.history = user.history.slice(-20);
        
        if (!isStart) user.lifetime_score += pointsEarned;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.performance, // ✅ Always a string now
            notes: result.notes, 
            score_added: pointsEarned, 
            new_total_score: user.lifetime_score,
            streak: user.speak_streak 
        });

    } catch (err) { 
        console.error(err);
        res.json({ reply: "My system is re-syncing. Let's try again, buddy!", performance: "Syncing...", notes: "Server sync." }); 
    }
});

// 📊 API: User Stats Interface
app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        res.json({ 
            score: user ? user.lifetime_score : 0, 
            level: user ? Math.floor(user.lifetime_score/1000)+1 : 1,
            streak: user ? user.speak_streak : 0 
        });
    } catch(e) { res.json({ score: 0, level: 1, streak: 0 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Mastery Engine (v8) running on port ${PORT}`));
