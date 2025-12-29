const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
// নিশ্চিত করুন আপনার index.html ফাইলটি 'public' ফোল্ডারের ভেতর আছে
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI || '', { maxPoolSize: 10 })
.then(() => console.log("🚀 Engine Synced!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
}));

app.post('/api/chat', async (req, res) => {
    let { message, userId, inputType, mode } = req.body; 
    try {
        let user = await User.findOne({ userId }) || new User({ userId });
        
        let modeInstruction = mode === 'Junior' ? "Style: Simple English, kind mentor tone." : 
                             (mode === 'Pro' ? "Style: Advanced English, IELTS/Business tone." : "Style: Natural everyday English.");

        const masterPrompt = `Role: Professional Male English Mentor.
        Instructions: 
        1. STRICTLY ENGLISH ONLY. 
        2. Never use labels like (Teach), (Review), or (Quiz). No brackets [].
        3. Give natural feedback, teach a tiny tip, and ask a question.
        4. Provide 2-3 practice options as a numbered list (e.g., 1. Hello, 2. Hi) at the very end.
        5. ${modeInstruction}
        Format: Always return a JSON object: {"reply": "your message here"}`;

        const historyContext = (user.history || []).slice(-6).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, ...historyContext, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${(process.env.GROQ_API_KEY || "").trim()}` } });

        let result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 10 : 2;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: result.reply });
        user.lifetime_score += points;
        await user.save();

        res.json({ reply: result.reply, score_added: points, new_total_score: user.lifetime_score });
    } catch (err) { 
        res.json({ reply: "I am ready to help you practice! Would you like to start? 1. Yes, let's go! 2. Sure!" }); 
    }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
