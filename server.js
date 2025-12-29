const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Enhanced Engine Synced!"))
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
        
        // 🧠 মাস্টার প্রম্পট: বাংলা রিভিউ ব্লক ও কুইজ মেথডোলজি
        const masterPrompt = `Identity: Friendly MALE English Mentor (Ustad style).
        Return Format: JSON object { "reply": "English quiz text + [A. | B. | C. ]", "bn_review": "Bengali content" }.
        
        Content Rules for "bn_review":
        1. Explain what you said in English simply.
        2. Correct user's English mistakes/pronunciation (if any) and give a positive review.
        3. Give clear instructions on what to do next.
        4. Always append: "আপনি চাইলে যেকোনো সময় টপিক পরিবর্তন করতে পারেন।"
        
        Methodology: Fixed Quiz-Based Learning.`;

        const historyContext = user.history.slice(-6).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, ...historyContext, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" } // JSON আউটপুট নিশ্চিত করা
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 10 : 2;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: result.reply });
        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            bn_review: result.bn_review, // নতুন বাংলা রিভিউ ফিল্ড
            score_added: points, 
            new_total_score: user.lifetime_score 
        });
    } catch (err) { res.json({ reply: "Assalamu Alaikum! Let's try again. [A. Sure! | B. Okay]", bn_review: "আসসালামু আলাইকুম! আমার কানেকশনে কিছুটা সমস্যা হচ্ছে। আমরা কি আবার শুরু করতে পারি?" }); }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Enhanced Server running on ${PORT}`));
