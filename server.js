const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ১. ডাটাবেস কানেকশন
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Talk24Ai Database Connected!"))
    .catch(err => console.error("❌ Database Error:", err));

// ২. ইউজার স্কিমা
const User = mongoose.model('User', {
    email: String,
    history: { type: Array, default: [] },
    dailyLimit: { type: Number, default: 10 },
    usedToday: { type: Number, default: 0 },
    lastActive: String,
    isPremium: { type: Boolean, default: false }
});

// ৩. ওস্তাদের নির্দেশাবলী
const BASE_INSTRUCTION = `
You are 'English Ustad', a strict but caring Bangladeshi teacher from Talk24Ai.
1. ALWAYS use **Bangla Script** for Bengali words.
2. Keep English words in English.
3. Keep the answer short (max 2 sentences).
4. Focus strictly on correcting their English mistakes.
`;

const USER_PROMPT = `${BASE_INSTRUCTION} 
Start with "Assalamu Alaikum". Help the student improve.`;

const GUEST_PROMPT = `${BASE_INSTRUCTION}
CRITICAL RULE: After answering, you MUST add a short, witty line in Bangla asking them to LOGIN.
Example: "বাবা, এত সুন্দর শিখছো, সব সেভ রাখতে লগইন করো।"
`;

// ৪. চ্যাট এপিআই
app.post('/api/chat', async (req, res) => {
    const { email, message, isGuest } = req.body;

    try {
        if (isGuest) {
            const reply = await callGroq([
                { role: "system", content: GUEST_PROMPT },
                { role: "user", content: message }
            ]);
            
            return res.json({ 
                reply, 
                isGuest: true,
                loginReminder: true 
            });
        }

        let user = await User.findOne({ email });
        const todayDate = new Date().toDateString();

        if (!user) {
            user = new User({ email, lastActive: todayDate });
        }

        if (user.lastActive !== todayDate) {
            user.usedToday = 0;
            user.lastActive = todayDate;
        }

        if (user.usedToday >= user.dailyLimit && !user.isPremium) {
            return res.json({ 
                reply: "আজকের কোটা শেষ বাবা! ওস্তাদের সাথে আনলিমিটেড কথা বলতে প্রিমিয়াম মেম্বারশিপ নাও।",
                quotaFull: true
            });
        }

        user.history.push({ role: "user", content: message });
        const context = user.history.slice(-10);

        const reply = await callGroq([{ role: "system", content: USER_PROMPT }, ...context]);

        user.usedToday += 1;
        user.history.push({ role: "assistant", content: reply });
        await user.save();
        
        res.json({ 
            reply, 
            limitInfo: { 
                used: user.usedToday, 
                limit: user.dailyLimit, 
                remaining: user.dailyLimit - user.usedToday 
            } 
        });

    } catch (err) {
        console.error("Chat API Error:", err.message);
        res.status(500).json({ reply: "ওস্তাদ এখন একটু বিশ্রাম নিচ্ছেন। কিছুক্ষণ পর আবার এসো।" });
    }
});

// ৫. Groq API কল (সংশোধিত মডেল সহ)
async function callGroq(messages) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", 
            max_tokens: 150,
            temperature: 0.7
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        if (err.response) {
            console.error("Groq Cloud Error Status:", err.response.status);
            console.error("Groq Cloud Error Data:", err.response.data);
        } else {
            console.error("Groq Connection Error:", err.message);
        }
        throw new Error("Groq Connection Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Ustad running on http://localhost:${PORT}`));