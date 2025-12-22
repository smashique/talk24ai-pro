const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 📂 DATABASE SETUP
const DB_FILE = path.join(__dirname, 'user_db.json');
const loadDB = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; } };
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// 🛡️ UTILS
const safeString = (val) => {
    if (val === null || val === undefined) return "";
    return String(val);
};

const cleanUnicode = (str) => {
    const s = safeString(str); 
    return s.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
};

const sanitizeInput = (text) => {
    const s = safeString(text);
    return s.replace(/<[^>]*>?/gm, '').trim();
};

// 🎰 INFINITE SCENARIO GENERATOR COMPONENTS
const LOCATIONS = [
    "Dhaka Metro Rail", "Busy Fish Market", "Expensive Restaurant", "Hospital Emergency Room", 
    "Job Interview Board", "Wedding Ceremony", "Police Station", "Tech Electronic Shop", 
    "Inside a Rickshaw", "Airport Immigration", "Library", "Gym", "Hotel Reception"
];

const CHARACTERS = [
    "An angry shopkeeper", "A confused tourist", "A strict police officer", "A crying child", 
    "Your impatient boss", "An old childhood friend", "A curious foreigner", "A rude taxi driver", 
    "A helpful doctor", "A rich businessman"
];

const CRISES = [
    "You lost your wallet", "You are getting late", "There is a misunderstanding", 
    "You broke something expensive", "You need urgent help", "You are trying to bargain hard", 
    "You are complaining about bad service", "You are giving good news"
];

// Helper to pick random element
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A' };
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A' };
        saveDB(db);
    }
    const score = db[userId].lifetime_score || 0;
    const level = Math.floor(score / 1000) + 1;
    res.json({ 
        total: db[userId].total_msgs, 
        score: score,
        level: level,
        lifetime_seconds: db[userId].total_time || 0 
    });
});

// 💬 API: CHAT (INFINITE ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
    // Extract Skill
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill };
    
    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    saveDB(db);

    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;

    // 🎲 DYNAMIC SCENARIO CONSTRUCTION (THE SLOT MACHINE)
    let generatedPrompt = "";
    if (isStart) {
        // Skill-based complexity scaling
        let loc = pick(LOCATIONS);
        let char = pick(CHARACTERS);
        let crisis = "";

        if (userSkill === 'A' || userSkill === 'B') {
            // Keep it simple for beginners
            crisis = "You need to buy something or ask a simple question.";
        } else {
            // Add chaos for experts
            crisis = pick(CRISES);
        }

        generatedPrompt = `
        [GENERATED MISSION]:
        - Location: ${loc}
        - Character: ${char}
        - Plot Twist/Goal: ${crisis}
        `;
    }

    try {
        let finalPrompt = "";
        
        const masterPrompt = `
        [SYSTEM ROLE]
        You are "Talk24AI", an infinite English Simulation Engine.
        
        [USER PROFILE]
        - Skill: ${userSkill}
        - XP Level: ${currentLevel}
        
        [PROTOCOL: TWO AGENTS]
        
        1. AGENT A (THE ACTOR):
           - Role: You are the Character defined in the Mission.
           - Tone: Adopt the emotion (Angry/Happy/Busy) perfectly.
           - Language: ENGLISH ONLY.
           - Behavior: Create an Immersive, 10-step RPG Scenario. Do not repeat the same question. React dynamically to the user.
        
        2. AGENT B (THE MENTOR):
           - Language: BANGLA SCRIPT (বাংলা).
           - Persona: Skilled Professional & Practicing Muslim.
           - Logic:
             - If User Makes Sense: +10 Points. Praise ("মাশাআল্লাহ!"). Move story forward.
             - If User is Confused/Wrong: 0 Points. Give a hint, correct the grammar, but Keep the Story Flowing (Don't get stuck).
        
        [OUTPUT JSON]:
        {
            "conversation": "Actor's reply (English)...",
            "learning_note": "Mentor's feedback (Bangla)...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: NEW SESSION.
            ${generatedPrompt}
            [TASK]: 
            1. Set the scene vividly (e.g., "You are at ${LOCATIONS}...").
            2. Start the roleplay with an opening line based on the character.
            3. In 'learning_note', explain the mission in Bangla.
            [JSON REQUIRED]`;
        } else {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: ONGOING DRAMA.
            [USER SAID]: "${message}"
            [TASK]:
            1. Judge input based on Skill ${userSkill}.
            2. Reply as the Actor (React to what user said). Introduce a new turn in the conversation.
            3. Keep it engaging and unpredictable!
            [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start Engine" : message }];
        
        // High Creativity Temperature
        const rawResponse = await callGroq(messages, 0.8); 
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 5 };
        } 
        catch (e) {
            parsedData = { conversation: "I understood. Let's continue.", learning_note: "চালিয়ে যান।", score_added: 5 }; 
        }

        if (!parsedData.conversation) parsedData.conversation = "Let's continue.";
        if (!parsedData.learning_note) parsedData.learning_note = "মাশাআল্লাহ, চালিয়ে যান।";

        if (!isStart && parsedData.score_added > 0) {
            db[userId].lifetime_score = (db[userId].lifetime_score || 0) + parsedData.score_added;
            saveDB(db);
        }

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note),
            score_added: parsedData.score_added || 0,
            new_total_score: db[userId].lifetime_score
        });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.json({ reply: "System update. Say again.", instruction: "আবার বলুন।" });
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.lifetime_score || 0) - (a.lifetime_score || 0));
    let html = `<html><body><h1>User Stats</h1><table border='1'><tr><th>ID</th><th>Skill</th><th>Score</th><th>Msgs</th></tr>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${u.current_skill}</td><td>${u.lifetime_score}</td><td>${u.total_msgs}</td></tr>`);
    res.send(html + `</table></body></html>`);
});

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.1-8b-instant", 
            max_tokens: 1024,
            temperature: temp,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${apiKey}` } });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Service Failed"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Infinite Engine running on port ${PORT}`));
