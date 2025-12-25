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
.then(() => console.log("🚀 Talk24AI Speak-Streak Engine Connected!"))
.catch(err => console.error("❌ DB Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    speak_streak: { type: Number, default: 0 }, // 🔥 স্ট্রিক সংখ্যা
    last_speak_date: { type: String, default: "" }, // 📅 শেষ কথা বলার তারিখ (YYYY-MM-DD)
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId, inputType } = req.body; 
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        // 🛡️ STREAK LOGIC
        if (inputType === 'voice') {
            const today = new Date().toISOString().split('T')[0];
            if (user.last_speak_date !== today) {
                const lastDate = user.last_speak_date ? new Date(user.last_speak_date) : null;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                if (user.last_speak_date === yesterdayStr) {
                    user.speak_streak += 1; // স্ট্রিক বজায় আছে
                } else {
                    user.speak_streak = 1; // স্ট্রিক ভেঙে গেছে বা নতুন শুরু
                }
                user.last_speak_date = today;
            }
        }

        const masterPrompt = `[IDENTITY] Proactive English Mentor. Muslim. Act as Character. 
        [FORMAT] Return JSON with "reply", "performance", "notes", "base_xp": 10.`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        
        let points = result.base_xp || 10;
        if (inputType === 'voice') points *= 2; // 2X XP

        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.performance, 
            notes: result.notes, 
            score_added: points, 
            new_total_score: user.lifetime_score,
            streak: user.speak_streak // ফ্রন্টএন্ডে স্ট্রিক পাঠানো হচ্ছে
        });
    } catch (err) { res.json({ reply: "Connection blink!" }); }
});

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

app.listen(3000, () => console.log(`🚀 Mastery Engine running on 3000`));
