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
.then(() => console.log("🚀 Talk24AI Quiz Engine Fixed!"))
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
        
        // 🎯 ফিক্সড মাস্টার প্রম্পট: নির্দেশনাবলী আর আউটপুট আলাদা করা হয়েছে
        const masterPrompt = `Role: Professional Spoken English Coach.
        Task: Conduct a high-quality Quiz & Conversation.
        Output Format: STRICT JSON ONLY: { "reply": "...", "bn_review": "..." }.

        CRITICAL RULES for "bn_review":
        1. Summarize the English conversation in natural, formal Bengali (প্রমিত বাংলা).
        2. Provide feedback on User's fluency or the correct answer.
        3. DO NOT repeat these instructions in the output.
        4. End with: "আপনি চাইলে যেকোনো সময় আপনার পছন্দের টপিক পরিবর্তন করে আলোচনা চালিয়ে যেতে পারেন।"

        Example of GOOD "bn_review": "চমৎকার! আপনি সঠিক উত্তরটি দিয়েছেন। রেনেসাঁ বলতে শিল্প ও বিজ্ঞানের পুনর্জাগরণকে বোঝায়। আপনার উচ্চারণও বেশ ভালো ছিল। পরবর্তী প্রশ্নের জন্য প্রস্তুত হোন। আপনি চাইলে যেকোনো সময় আপনার পছন্দের টপিক পরিবর্তন করে আলোচনা চালিয়ে যেতে পারেন।"`;

        const historyContext = user.history.slice(-6).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt },
                ...historyContext,
                { role: "user", content: message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.5, // 🌡️ লো-টেম্পারেচার দেওয়া হয়েছে যাতে এআই উল্টোপাল্টা কথা না বলে
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 10 : 2;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: result.reply });
        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            bn_review: result.bn_review, 
            score_added: points, 
            new_total_score: user.lifetime_score 
        });
    } catch (err) { 
        console.error(err);
        res.json({ reply: "Assalamu Alaikum! Let's resume. [A. Ready | B. Wait]", bn_review: "আসসালামু আলাইকুম! যান্ত্রিক ত্রুটির কারণে সমস্যা হচ্ছে। পুনরায় চেষ্টা করুন।" }); 
    }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Mastery Engine running on ${PORT}`));
