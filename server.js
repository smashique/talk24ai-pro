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
.then(() => console.log("🚀 Talk24AI Spoken Focus Engine Synced!"))
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
        
        // 🎯 GB কনফিগারড মাস্টার প্রম্পট: স্পোকেন ইংলিশ ফোকাস ও প্রমিত বাংলা
        const masterPrompt = `Identity: Professional Male Spoken English Coach (Ustad style).
        Core Focus: Conversational Spoken English (Fluency, Pronunciation tips, Sentence structure).
        Language Rule: All Bengali explanations MUST be in "Standard Bengali" (প্রমিত বাংলা).
        
        Return Format: JSON { "reply": "English content + [A. | B. | C. ]", "bn_review": "Standard Bengali Review" }.
        
        "bn_review" Content Structure:
        1. আপনি ইংরেজিতে যা বললেন তার একটি সারসংক্ষেপ এবং সঠিক অর্থ।
        2. আপনার স্পোকেন ইংলিশের উন্নতির জন্য প্রয়োজনীয় সংশোধন (Grammar, Pronunciation)।
        3. পরবর্তী ধাপের জন্য স্পষ্ট দিকনির্দেশনা।
        4. শেষে এই বাক্যটি যুক্ত করুন: "আপনি চাইলে যেকোনো সময় আপনার পছন্দের টপিক পরিবর্তন করে আলোচনা চালিয়ে যেতে পারেন।"`;

        const historyContext = user.history.slice(-6).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, ...historyContext, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 15 : 5;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: result.reply });
        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            bn_review: result.bn_review, 
            score_added: points, 
            new_total_score: user.lifetime_score 
        });
    } catch (err) { res.json({ reply: "Assalamu Alaikum! Let's resume our spoken practice. [A. Ready! | B. Sure]", bn_review: "আসসালামু আলাইকুম! যান্ত্রিক ত্রুটির কারণে সংযোগ বিচ্ছিন্ন হয়েছে। আমরা কি পুনরায় কথা বলা শুরু করতে পারি?" }); }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Spoken Focus Server running on ${PORT}`));
