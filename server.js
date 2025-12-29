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
        
        // 🎯 Mode-Based AI Prompt Configuration
        let modeInstruction = "";
        if (mode === 'Junior') {
            modeInstruction = "Style: Simple English, short sentences, primary level vocabulary. Be very encouraging like a kind teacher.";
        } else if (mode === 'Pro') {
            modeInstruction = "Style: Advanced English, use idioms, complex sentence structures, and professional/academic topics (IELTS/Business).";
        } else {
            modeInstruction = "Style: Standard everyday English, natural conversational flow, suitable for general learners.";
        }

        const masterPrompt = `Role: Professional Male English Mentor.
        Task: Conduct English Spoken Practice and Quizzes.
        ${modeInstruction}
        Language Rule: STRICTLY ENGLISH ONLY. 
        Format: Return JSON object with a "reply" field.`;

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
            temperature: 0.6,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
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
        res.json({ reply: "Connection synced. Ready to continue our practice? [A. Yes! | B. Let's go]" }); 
    }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Multi-Mode Lab running on ${PORT}`));
