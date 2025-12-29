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
.then(() => console.log("🚀 Talk24AI Multi-Mode Engine Synced!"))
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
        
        // 🎯 Mode-Based Style Configuration
        let modeInstruction = "";
        if (mode === 'Junior') {
            modeInstruction = "Style: Simple English, short sentences, kid-friendly vocabulary. Be a very kind and fun teacher.";
        } else if (mode === 'Pro') {
            modeInstruction = "Style: Advanced English, complex idioms, professional/academic tone (IELTS/Business). Challenge the user.";
        } else {
            modeInstruction = "Style: Standard everyday English, natural conversational flow for general learners.";
        }

        // 🧠 Core AI Logic: Teach -> Quiz -> Practice -> Review
        const masterPrompt = `Role: Professional Male English Mentor.
        Instruction: 
        1. STRICTLY ENGLISH ONLY. No other languages.
        2. Detect the user's mood and topic of interest from their message.
        3. FLOW: 
           - Give a tiny feedback/review on their previous spoken effort (if any).
           - Teach a small English tip or phrase related to their interest.
           - Ask a question or create a situational quiz.
           - ALWAYS provide 2-3 practice options in brackets at the end, formatted as: [Option 1 | Option 2].
        4. ${modeInstruction}
        Format: Return ONLY a JSON object with a "reply" field. Example: {"reply": "Great job! (Review) Let's learn 'How's it going?'. (Teach) How would you greet a friend? (Quiz) [Hey, how's it going? | Hi there!]"}`;

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
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        
        // Reward more points for Voice input to encourage speaking
        let points = (inputType === 'voice') ? 10 : 2;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: result.reply });
        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            score_added: points, 
            new_total_score: user.lifetime_score 
        });
    } catch (err) { 
        res.json({ reply: "I'm ready to help you practice! Shall we start with a fun topic? [Yes, let's go! | Sure, why not?]" }); 
    }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24AI Engine running on ${PORT}`));
