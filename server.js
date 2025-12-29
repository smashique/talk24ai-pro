const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Engine Synced!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
}));

app.post('/api/chat', async (req, res) => {
    let { message, userId, inputType } = req.body; 

    try {
        let user = await User.findOne({ userId }) || new User({ userId });
        
        // NotebookLM টোন অনুযায়ী মাস্টার প্রম্পট (Male Mentor)
        const masterPrompt = `Identity: You are a friendly, encouraging MALE English Mentor (Brother/Ustad style).
        Style: Follow NotebookLM's natural, calm, and simple dialogue style.
        Rule: Greet with 'Assalamu Alaikum'. Always keep track of the last few sentences.
        Task: Guide the user to speak English. If they are silent, give a simple prompt or question.
        Note: DO NOT use complex JSON unless needed. Just return clear text for the 'reply'.`;

        // লাস্ট ৬টি মেসেজ হিস্ট্রি হিসেবে নেওয়া (৩ জোড়া)
        const historyContext = user.history.slice(-6).map(h => ({ role: h.role === 'User' ? 'user' : 'assistant', content: h.content }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt },
                ...historyContext,
                { role: "user", content: message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const replyText = response.data.choices[0].message.content;
        let points = (inputType === 'voice') ? 20 : 5;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: replyText });
        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: replyText, 
            score_added: points, 
            new_total_score: user.lifetime_score 
        });
    } catch (err) { res.json({ reply: "Assalamu Alaikum! I'm here. Can you say that again?" }); }
});

app.post('/api/stats', async (req, res) => {
    const user = await User.findOne({ userId: req.body.userId });
    res.json({ score: user ? user.lifetime_score : 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Kids-Talk Engine running on ${PORT}`));
