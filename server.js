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
.then(() => console.log("🚀 Talk24AI Master Academy DB Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

// 📘 THE GRAND SYLLABUS METADATA (Cross-checked with GB Experts)
const ACADEMY_METADATA = {
    'A': { age: "6-10", name: "Beginner", focus: "Basic Nouns & Fun Functional Grammar", tone: "Magic, Fun, Simple", goal: "Social Confidence" },
    'B': { age: "10-16", name: "Learner", focus: "Action Verbs, Articles, Daily Routines", tone: "Energetic, Teen-friendly", goal: "Fluent Description" },
    'C': { age: "17-24", name: "Hesitant", focus: "Description, Pronouns, Confidence Building", tone: "Supportive, Adult-casual", goal: "Social Conversationalist" },
    'D': { age: "17-24", name: "IELTS/GRE", focus: "Tenses, Connectors, Logic, High-level Vocabulary", tone: "Academic, Formal, Strict", goal: "High Band Achievement" },
    'E': { age: "24-34", name: "Professional", focus: "Idioms, Phrasal Verbs, Business Ethics", tone: "Corporate, Polished, Leader-like", goal: "Career Mastery" }
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-E])/) ? systemInstruction.match(/Skill Level: ([A-E])/)[1] : 'A';
    const isStart = message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const trackInfo = ACADEMY_METADATA[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1; // 1 to 100
        
        if (isStart) user.history = [];
        const context = user.history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 SAIFUR SIR + GB EXPERTS INTELLIGENT PROMPT
        const masterPrompt = `
        [IDENTITY] World-class English Mentor (Saifur Sir Style) & Practicing Muslim. 
        [ALL ENGLISH] Speak ONLY English.

        [TRACK DETAILS]
        - Track: ${trackInfo.name} | Target Age: ${trackInfo.age} years old.
        - Current Level: ${currentLevel} of 100.
        - Academic Focus: ${trackInfo.focus}.
        - Required Tone: ${trackInfo.tone}.
        
        [SPECIFIC INSTRUCTIONS]
        1. IF STARTING: Mentor greets, states the Achievement Badge name for Level ${currentLevel}, and explains the Mission Goal clearly based on age ${trackInfo.age}.
        2. ROLEPLAY: Create a realistic scenario suitable for a ${trackInfo.age} year old. 
        3. NO ECHO: Actor must move the story forward and NOT repeat user words.
        4. SCORING: Give +10 XP ONLY if the user uses grammar/vocabulary relevant to "${trackInfo.focus}" correctly.
        5. ISLAMIC AKHLAQ: Teach polite manners and Islamic values naturally in English.

        [JSON OUTPUT]
        {
          "conversation": "Actor's age-appropriate reply",
          "learning_note": "• Review: Feedback on ${trackInfo.focus}\\n• Tip: Saifur Sir's practical shortcut\\n• Next Step: Strategy guide",
          "score_added": 10 or 0
        }
        
        History: ${context}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? "Action! Start my mission." : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 20000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        // Persistent Save
        user.history.push({ role: 'User', content: isStart ? "Started" : message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 8) user.history = user.history.slice(-8);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        
        await user.save();

        res.json({ 
            reply: result.conversation, 
            instruction: result.learning_note, 
            score_added: result.score_added, 
            new_total_score: user.lifetime_score 
        });

    } catch (err) { res.json({ reply: "Our Magic Server is busy. Try again, hero!", instruction: "• Connection error." }); }
});

app.post('/api/stats', async (req, res) => {
    const user = await User.findOne({ userId: req.body.userId });
    if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
    else res.json({ score: 0, level: 1 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Multi-Track Mastery Engine running on port ${PORT}`));
