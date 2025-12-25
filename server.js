const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION (Expert Persistence Logic)
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Talk24AI Immersive Engine Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

const SYLLABUS = {
    'A': { name: "Beginner", age: "6-10", goal: "Basic Vocabulary & Simple Needs", tone: "Exciting, Magic, Cheerful" },
    'B': { name: "Learner", age: "10-16", goal: "Expressing Likes/Dislikes & Daily Routine", tone: "Cool, High-energy, Friendly" },
    'C': { name: "Hesitant", age: "17-24", goal: "IELTS Prep & Abstract Opinions", tone: "Empathetic, Supportive, Relaxed" },
    'D': { name: "Professional", age: "24-34", goal: "Corporate Communication & Leadership", tone: "Corporate, Assertive, Sharp" }
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    
    // 🎯 TOPIC DETECTION LOGIC
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Conversation";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        if (isStart) user.history = [];
        const trackInfo = SYLLABUS[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1;
        
        // 🔄 Context Persistence (Last 10 turns for deep memory)
        const historyContext = user.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 THE EXPERT CHARACTER-LOCK PROMPT
        const masterPrompt = `
        [IDENTITY] World-class Proactive English Mentor & Practicing Muslim. 
        [VALUES] Use Salam naturally. ONLY speak English. NO BENGALI.

        [THE CHARACTER LOCK - CRITICAL BUG FIX]
        You MUST NOT explain the topic or act like a teacher. Become the character IMMEDIATELY.
        - Topic "Best Friend" -> You are the User's closest childhood friend. Use slang like "buddy" or "mate".
        - Topic "Red Apple" -> You are a friendly fruit seller.
        - Topic "Interview" -> You are a strict but fair HR Manager.
        
        [ADDITION & METHODOLOGY RULES]
        1. THE SOCRATIC HOOK: Never finish a message without a question. Keep the user "Addicted" to replying.
        2. SMART SCAFFOLDING: Always provide 2 short answer choices in brackets at the very end.
           - Format: [A. Option 1 | B. Option 2]
        3. SCAFFOLDING FEEDBACK: Acknowledge the user's previous sentence: "${user.history.length > 0 ? user.history[user.history.length-1].content : 'Starting now'}".
        4. VARIABLE XP: Assign 5-20 points in "score_added" based on English grammar and effort.

        [MISSION CONFIG]
        Track: ${trackInfo.name} | Topic: ${currentTopic} | Tone: ${trackInfo.tone}

        [JSON OUTPUT FORMAT]
        {
          "conversation": "Character-locked immersive reply + Engaging Question + [A. Choice 1 | B. Choice 2]",
          "learning_note": "• Review: Feedback\\n• Tip: A quick English hack\\n• Next: Milestone",
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

        res.json({ 
            reply: result.conversation, 
            instruction: result.learning_note, 
            score_added: result.score_added || 10, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { 
        res.json({ reply: "My magic character mask is slipping! Let's try again, buddy.", instruction: "• Note: Server sync." }); 
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
app.listen(PORT, () => console.log(`🚀 Multi-Track Expert Engine (Version 5) running on port ${PORT}`));
