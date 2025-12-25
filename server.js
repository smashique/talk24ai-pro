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
.then(() => console.log("🚀 Talk24AI Professional Mastery Engine Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const SYLLABUS = {
    'A': { name: "Beginner", age: "6-10", goal: "Basic Vocabulary & Simple Needs" },
    'B': { name: "Learner", age: "10-16", goal: "Expressing Likes/Dislikes & Daily Routine" },
    'C': { name: "Hesitant", age: "17-24", goal: "IELTS Preparation & Abstract Opinions" },
    'D': { name: "Professional", age: "24-34", goal: "Corporate Communication & Leadership" }
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Conversation";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        if (isStart) user.history = [];
        const trackInfo = SYLLABUS[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1;
        
        const historyContext = user.history.slice(-8).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 EXPERT PROMPT WITH SMART SCAFFOLDING & POSITIVE REINFORCEMENT
        const masterPrompt = `
        [IDENTITY] World-class Proactive English Mentor & Practicing Muslim. 
        [VALUES] Use Salam and Islamic etiquette. ONLY speak English. NO Bengali.

        [PEDAGOGY PROTOCOL - SMART SCAFFOLDING]
        1. POSITIVE REINFORCEMENT: If the user provides their name or a good answer, praise them enthusiastically (e.g., "What a beautiful name!", "Excellent choice!").
        2. SMART OPTIONS: For tracks A & B, or whenever a user might be stuck, include 2 short answer choices in brackets at the end of your question. 
           Example: "What brings you here today? [A. I want a toy | B. I want an apple]"
        3. THE HOOK: Every reply MUST end with an engaging question.
        4. NO HALLUCINATION: TEXT-ONLY. Never mention pictures or screens.

        [MISSION CONFIGURATION]
        - Track: ${trackInfo.name} (Age: ${trackInfo.age}) | Topic: ${currentTopic} | Level: ${currentLevel}
        - AI ROLE: Friendly character based on topic. USER ROLE: Appropriate counterpart.

        [JSON OUTPUT]
        {
          "conversation": "Enthusiastic character response + Engaging Question + [A. Option 1 | B. Option 2]",
          "learning_note": "• Review: Feedback on usage\\n• Tip: A simple trick for this topic\\n• Next: Mission goal",
          "score_added": 5-20
        }
        
        History Context:\n${historyContext}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? `Start mission: ${currentTopic}` : message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.8,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 12) user.history = user.history.slice(-12);
        
        if (!isStart) user.lifetime_score += (result.score_added || 10);
        await user.save();

        res.json({ 
            reply: result.conversation, 
            instruction: result.learning_note, 
            score_added: result.score_added || 10, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { 
        res.json({ reply: "My connection is blinking. Let's try again, my friend!", instruction: "• Note: System sync." }); 
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
app.listen(PORT, () => console.log(`🚀 Multi-Track Expert Engine (Smart Scaffolding) running on port ${PORT}`));
