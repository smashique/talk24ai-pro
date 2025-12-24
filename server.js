const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION (Optimized)
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
})
.then(() => console.log("✅ DB Connected & Ready!"))
.catch(err => console.error("❌ DB Connection Failed:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    total_msgs: { type: Number, default: 0 },
    lifetime_score: { type: Number, default: 0 },
    total_time: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const cleanUnicode = (str) => String(str).replace(/\\u[\dA-F]{4}/gi, (m) => String.fromCharCode(parseInt(m.replace(/\\u/g, ''), 16)));

const CURRICULUM = {
    'A': 'Nouns & Greetings', 'B': 'Action Verbs & Articles',
    'C': 'Adjectives & Pronouns', 'D': 'Tenses & Connectors', 'E': 'Idioms & Phrasal Verbs'
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const userLevel = systemInstruction.match(/Skill Level: ([A-E])/) ? systemInstruction.match(/Skill Level: ([A-E])/)[1] : 'A';
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const isStart = message === "Action!";
        if (isStart) user.history = [];
        else user.total_msgs += 1;

        const currentFocus = CURRICULUM[userLevel];
        const historyText = user.history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 STABLE EXPERT PROMPT (JSON Optimized)
        const masterPrompt = `You are a World-class English Mentor and a practicing Muslim.
        Role: Act as a human character in a unique scenario for Level ${userLevel}.
        Focus: Evaluate the user's use of "${currentFocus}". 
        Preach Islamic values (Akhlaq) in your tone.
        Strict: Speak ONLY English. NO other language.

        [JSON STRUCTURE REQUIRED]
        {
          "conversation": "Actor's human-like reply. Never repeat the user.",
          "learning_note": "• Review of ${currentFocus}\\n• Tip on ${currentFocus}\\n• Next Step guide",
          "score_added": 10 or 0
        }
        
        History: ${historyText}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? "Action! Start scenario." : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { 
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` },
            timeout: 20000 
        });

        const result = JSON.parse(response.data.choices[0].message.content);

        // Update Persistence in Background
        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 8) user.history = user.history.slice(-8);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        
        user.save(); // Save without blocking response for speed

        res.json({ 
            reply: cleanUnicode(result.conversation), 
            instruction: cleanUnicode(result.learning_note), 
            score_added: result.score_added || 0, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) {
        console.error("Critical Hang Error:", err.message);
        res.json({ 
            reply: "The connection is stabilizing. Please try again.", 
            instruction: "• Review: Minor sync delay.\\n• Tip: Keep your sentence clear.\\n• Next Step: Repeat your last input." 
        });
    }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ total: user.total_msgs, score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1, lifetime_seconds: user.total_time });
        else res.json({ total:0, score:0, level:1, lifetime_seconds:0 });
    } catch (e) { res.json({ total:0, score:0, level:1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Stable Mastery Engine running on port ${PORT}`));
