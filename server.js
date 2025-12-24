const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Global Academy DB Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const ACADEMY_METADATA = {
    'A': { age: "6-10", name: "Beginner", focus: "TPR & Functional Naming", tone: "Magic, Encouraging, Fun", goal: "Foundation & Confidence" },
    'B': { age: "10-16", name: "Learner", focus: "Communicative Competence & Routines", tone: "Dynamic, Youthful, Engaging", goal: "Daily Fluency" },
    'C': { age: "17-24", name: "Hesitant", focus: "Cognitive Confidence & Opinion Flow", tone: "Empathetic, Supportive, Relaxed", goal: "Social Conversationalist" },
    'D': { age: "17-24", name: "IELTS/GRE", focus: "Rubric-based Logic & Connectors", tone: "Analytical, Formal, Structured", goal: "Academic Excellence" },
    'E': { age: "24-34", name: "Professional", focus: "ESP (Specific Purposes) & Leadership Tone", tone: "Corporate, Assertive, Polished", goal: "Career Authority" }
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-E])/) ? systemInstruction.match(/Skill Level: ([A-E])/)[1] : 'A';
    const isStart = message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const trackInfo = ACADEMY_METADATA[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1;
        
        if (isStart) user.history = [];
        const contextHistory = user.history.slice(-6).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 UPDATED MASTER PROMPT WITH HALLUCINATION FIX
        const masterPrompt = `
        [IDENTITY] World-class Global English Specialist & Practicing Muslim.
        [TONE] ${trackInfo.tone}. Use Islamic Akhlaq (Salam/JazakAllah) naturally.
        [STRICT RULE] Speak ONLY in English. Never mention "seeing pictures" or "looking at a screen" because this is a voice/text only interface.

        [ENGAGEMENT & IMAGINATION PROTOCOL]
        1. NO VISUAL HALLUCINATION: Instead of "You will see a picture", say "Imagine we are at..." or "Let's use our imagination to visit...".
        2. SENSITIVITY: If the user says "I can't see it," kindly explain: "This is a magic game of imagination! Close your eyes and think of...".
        3. SOCRATIC LOOP: Always end with a direct, age-appropriate question. For Kids (Track A), use choices (e.g., "Is it a cat or a dog?").
        4. ROLEPLAY: Act as a character based on Level ${currentLevel} for age ${trackInfo.age}.
        5. PERSISTENCE: Acknowledge the context of the previous turn: "${user.history.length > 0 ? user.history[user.history.length-1].content : ''}".

        [ACADEMIC DETAILS]
        - Track: ${trackInfo.name} | Focus: ${trackInfo.focus}
        
        [JSON FORMAT]
        {
          "conversation": "Actor's response + ONE engaging direct question",
          "learning_note": "• Review: Feedback\\n• Tip: Imagine-based shortcut\\n• Next: Mission",
          "score_added": 10 or 0
        }
        
        History:\n${contextHistory}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? "Action! Let's use our imagination to start." : message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.8,
            response_format: { type: "json_object" }
        }, { 
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, 
            timeout: 25000 
        });

        const result = JSON.parse(response.data.choices[0].message.content);

        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 10) user.history = user.history.slice(-10);
        
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        await user.save();

        res.json({ 
            reply: result.conversation, 
            instruction: result.learning_note, 
            score_added: result.score_added, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { 
        res.json({ reply: "My connection is refreshing. Let's try again, my friend!", instruction: "• Note: System sync." }); 
    }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
        else res.json({ score: 0, level: 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Mastery Engine v3 (Imagination Mode) running on ${PORT}`));
