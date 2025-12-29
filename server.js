const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Public folder theke static files serve kora
app.use(express.static(path.join(__dirname, 'public')));

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
        const masterPrompt = `Identity: Friendly MALE English Mentor. Style: Simple dialogue like NotebookLM. Greet with 'Assalamu Alaikum'.`;
        const historyContext = user.history.slice(-6).map(h => ({ role: h.role === 'User' ? 'user' : 'assistant', content: h.content }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, ...historyContext, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const replyText = response.data.choices[0].message.content;
        let points = (inputType === 'voice') ? 20 : 5;
        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: replyText });
        user.lifetime_score += points;
        await user.save();
        res.json({ reply: replyText, score_added: points, new_total_score: user.lifetime_score });
    } catch (err) { res.json({ reply: "Assalamu Alaikum! Amar connection ektu somossa korche. Abar bolbe?" }); }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
