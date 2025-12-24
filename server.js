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
.then(() => console.log("🚀 Talk24AI 400-Topic Engine Synced!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

// 📘 NEW 4-MODULE SYLLABUS DATA (Mapped exactly to user request)
const SYLLABUS = {
    'A': { 
        name: "Beginner", age: "6-10", goal: "Basic Vocabulary & Simple Needs",
        topics: {
            1: "Greetings & Self", 11: "Family", 21: "Colors", 31: "Numbers & Counting",
            41: "Body Parts", 51: "Animals", 61: "Food & Drink", 71: "House & Home",
            81: "School Objects", 91: "Actions (Verbs)"
        }
    },
    'B': { 
        name: "Learner", age: "10-16", goal: "Likes/Dislikes & Daily Routine",
        topics: {
            1: "School Life", 11: "Hobbies", 21: "Technology", 31: "Food & Restaurants",
            41: "Daily Routine", 51: "Emotions", 61: "Shopping", 71: "Travel & Outing",
            81: "Weather & Nature", 91: "Social Skills"
        }
    },
    'C': { 
        name: "Hesitant", age: "17-24", goal: "IELTS Prep & Abstract Ideas",
        topics: {
            1: "IELTS Speaking Topics", 11: "Social Issues", 21: "University Life", 31: "Technology & Ethics",
            41: "Travel & Culture", 51: "Relationships", 61: "Health & Lifestyle", 71: "Abstract Concepts",
            81: "Entertainment", 91: "Practical Situations"
        }
    },
    'D': { 
        name: "Professional", age: "24-34", goal: "Corporate Communication & Leadership",
        topics: {
            1: "Interview Skills", 11: "Meetings", 21: "Communication", 31: "Office Dynamics",
            41: "Leadership", 51: "Business Concepts", 61: "Client Handling", 71: "HR & Career",
            81: "Tech in Business", 91: "Global Business"
        }
    }
};

// Helper function to get the current topic category name
function getTopicCategory(track, level) {
    const categories = SYLLABUS[track].topics;
    const sortedKeys = Object.keys(categories).map(Number).sort((a, b) => b - a);
    const key = sortedKeys.find(k => level >= k) || 1;
    return categories[key];
}

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    const isStart = message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const trackInfo = SYLLABUS[trackCode];
        const currentLevel = Math.floor(user.lifetime_score / 1000) + 1;
        const currentTopic = getTopicCategory(trackCode, currentLevel > 100 ? 100 : currentLevel);

        if (isStart) user.history = [];
        const lastTurn = user.history.length > 0 ? user.history[user.history.length - 1].content : "Session initialized.";

        const masterPrompt = `
        [IDENTITY] World-class Proactive English Specialist & Practicing Muslim.
        [VALUES] Use Islamic Akhlaq (Salam/JazakAllah) naturally. Speak ONLY English.

        [NEW SYLLABUS LOGIC]
        - Track: ${trackInfo.name} (Age: ${trackInfo.age})
        - Level: ${currentLevel} of 100
        - Current Topic Category: ${currentTopic}
        - Mission Goal: ${trackInfo.goal}

        [ADDICTION & ENGAGEMENT]
        1. SOCRATIC LOOP: Every reply MUST end with ONE engaging question related to the topic: "${currentTopic}".
        2. STORY MISSION: Create a scenario for Level ${currentLevel} based on "${currentTopic}". 
        3. SCAFFOLDING: Build on the user's last input: "${lastTurn}".
        4. VARIABLE REWARDS: Grant points (5-20) in "score_added" based on effort.
        5. IMAGINATION ONLY: Never mention pictures or looking at a screen.

        [JSON OUTPUT]
        {
          "conversation": "Proactive character response + Topic Scenario + One Engaging Question",
          "learning_note": "• Review: Feedback on ${currentTopic}\\n• Tip: Quick shortcut for Level ${currentLevel}\\n• Next: Milestone unlocked",
          "score_added": 5-20
        }`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt }, 
                { role: "user", content: isStart ? "Action! Start my mission." : message }
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
            reply: result.conversation, instruction: result.learning_note, 
            score_added: result.score_added || 10, new_total_score: user.lifetime_score 
        });

    } catch (err) { res.json({ reply: "My magic book is refreshing! Let's continue. Try again?", instruction: "• Note: System sync." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
        else res.json({ score: 0, level: 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 400-Topic Mastery Engine running on ${PORT}`));
