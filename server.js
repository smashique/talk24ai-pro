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
.then(() => console.log("🚀 Talk24AI Value-Driven Engine Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const SYLLABUS = {
    'A': { name: "Beginner", age: "6-10", goal: "Basic Vocabulary", tone: "Magic, Fun" },
    'B': { name: "Learner", age: "10-16", goal: "Daily Routine Fluency", tone: "Cool, Friendly" },
    'C': { name: "Hesitant", age: "17-24", goal: "IELTS & Opinion Flow", tone: "Relaxed, Supportive" },
    'D': { name: "Professional", age: "24-34", goal: "Corporate Leadership", tone: "Assertive, Sharp" }
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
        
        const historyContext = user.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 THE "VALUE-PERCEPTION" MASTER PROMPT
        const masterPrompt = `
        [IDENTITY] Proactive English Mentor & Character Actor. Practicing Muslim.
        [RULES] Salam/Islamic Akhlaq only. Speak English ONLY.

        [THE CHARACTER LOCK]
        Instantly become: ${currentTopic === "General Conversation" ? "A friendly guide" : "Character related to " + currentTopic}. 
        NO teacher tone. Talk naturally like a friend/seller/manager.

        [VALUE-ADDED ASSESSMENT LOGIC - NEW]
        Evaluate the user's LAST message: "${message}" based on:
        1. Fluency (0-100)
        2. Grammar (0-100)
        3. Vocabulary (0-100)
        Provide a "Performance Status" (e.g., Novice, Growing, Pro).

        [ADDICTION & SCAFFOLDING]
        1. SOCRATIC HOOK: End with a character-based question.
        2. SMART OPTIONS: Provide 2 short choices: [A. Option | B. Option]
        3. VARIABLE XP: Assign 5-20 points based on assessment quality.

        [JSON OUTPUT FORMAT]
        {
          "conversation": "Character reply + Question + [A. Choice 1 | B. Choice 2]",
          "learning_note": "• Review: Feedback\\n• Tip: English Hack\\n• Next: Road to Level ${currentLevel + 1}",
          "performance_card": "Fluency: X% | Grammar: Y% | Vocab: Z% | Status: Level ${currentLevel}",
          "score_added": 5-20
        }
        
        History:\n${historyContext}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? `Mission: ${currentTopic}` : message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.8,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        // 💾 Save to Server History
        user.history.push({ role: 'User', content: message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 15) user.history = user.history.slice(-15);
        
        if (!isStart) user.lifetime_score += (result.score_added || 10);
        await user.save();

        // Include the performance card in the instruction for display
        const finalInstruction = result.performance_card + "\\n" + result.learning_note;

        res.json({ 
            reply: result.conversation, 
            instruction: finalInstruction, 
            score_added: result.score_added || 10, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { 
        res.json({ reply: "My system is stabilizing! Let's try again, buddy.", instruction: "• Note: Assessment sync in progress." }); 
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
app.listen(PORT, () => console.log(`🚀 Mastery & Assessment Engine (v6) running on port ${PORT}`));
