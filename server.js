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
// Note: On Render Free Tier, this file resets after 15 mins of inactivity.
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

// 🌍 SEPARATE WORLDS
const KIDS_WORLD = {
    locations: ["Toy Shop", "Ice Cream Van", "School Playground", "Zoo", "Grandma's House", "Cartoon World", "Chocolate Factory"],
    characters: ["A Friendly Rabbit", "The Ice Cream Man", "Your Best Friend", "A Talking Cat", "Grandmother", "A Funny Clown"],
    crises: ["You want a blue candy", "You lost your ball", "You want to play", "You are hungry", "You made a drawing"]
};

const ADULT_WORLD = {
    locations: ["Dhaka Metro Rail", "Corporate Office", "Airport Immigration", "Hospital", "Job Interview Board", "Fancy Restaurant", "Police Station"],
    characters: ["A Strict Officer", "An Impatient Boss", "A Foreign Client", "A Doctor", "A Taxi Driver", "Hotel Receptionist"],
    crises: ["You lost your wallet", "You are late for a meeting", "Negotiating a salary", "Explaining a mistake", "Booking a flight", "Complaining about service"]
};

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

// 💬 API: CHAT (FIXED ENGINE)
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

    // 🔥 1. SELECT WORLD
    let world = (userSkill === 'A' || userSkill === 'B') ? KIDS_WORLD : ADULT_WORLD;

    // 🔥 2. GENERATE SCENARIO
    let generatedScenario = "";
    if (isStart) {
        generatedScenario = `
        [SCENARIO MISSION]
        - Location: ${pick(world.locations)}
        - Character: ${pick(world.characters)}
        - Goal: ${pick(world.crises)}
        `;
    }

    // 🔥 3. DEFINE TONE (FIXED)
    let complexityRules = "";
    let mentorTone = "";

    switch(userSkill) {
        case 'A': // Kid
            complexityRules = "English Agent: Use extremely simple words. Short sentences. Be playful.";
            mentorTone = "Bangla Mentor: You are talking to a CHILD. Use 'Tumi' (তুমি). Tone: Sweet, affectionate, like a big brother.";
            break;
        case 'B': // Learner
            complexityRules = "English Agent: Simple daily English. Helpful tone.";
            mentorTone = "Bangla Mentor: Use 'Tumi' (তুমি). Tone: Encouraging friend.";
            break;
        case 'C': // Hesitant
            complexityRules = "English Agent: Intermediate English. Patient tone.";
            mentorTone = "Bangla Mentor: Use 'Apni' (আপনি). Tone: Respectful guide.";
            break;
        case 'D': // IELTS
            complexityRules = "English Agent: Formal, academic vocabulary.";
            mentorTone = "Bangla Mentor: Use 'Apni' (আপনি). Tone: Professional Coach.";
            break;
        case 'E': // Pro
            complexityRules = "English Agent: Business professional, fast-paced.";
            mentorTone = "Bangla Mentor: Use 'Apni' (আপনি). Tone: Corporate Consultant.";
            break;
    }

    try {
        let finalPrompt = "";
        
        // 🧠 FIXED MASTER PROMPT
        const masterPrompt = `
        [SYSTEM ROLE]
        You are "Talk24AI", an advanced English Training Engine.
        
        [CURRENT PROFILE]
        - Skill Level: ${userSkill} (A/B = Kids, C/D/E = Adults)
        - XP: ${currentLevel}
        
        [PROTOCOL: TWO AGENTS]
        
        1. AGENT A (THE ACTOR):
           - Role: Roleplay the assigned character.
           - Language: ENGLISH ONLY.
           - **Complexity**: ${complexityRules}
           - Behavior: Be natural, engaging, and drive the scenario forward.
           - Identity: Practicing Muslim background (uses Islamic greetings if appropriate), but focuses on the English lesson.
        
        2. AGENT B (THE MENTOR):
           - Language: BANGLA SCRIPT (বাংলা).
           - **Tone**: ${mentorTone}
           - Psychology: Deeply caring, problem solver. Wants to build confidence.
           - **SCORING LOGIC (CRITICAL)**:
             - If user's English is understandable (even with small errors) -> Score +10.
             - If user talks nonsense or wrong language -> Score 0.
             - **MANDATORY**: If Level is A/B, YOU MUST USE 'TUMI' (তুমি).
        
        [OUTPUT JSON FORMAT]:
        {
            "conversation": "Actor's reply in English...",
            "learning_note": "Mentor's feedback in Bangla...",
            "score_added": 10
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: NEW SESSION.
            ${generatedScenario}
            [TASK]: 
            1. Actor: Start the roleplay based on the Location/Character.
            2. Mentor: Explain the mission in Bangla.
            [JSON REQUIRED]`;
        } else {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: ONGOING.
            [USER SAID]: "${message}"
            [TASK]:
            1. Analyze user input.
            2. Actor: Reply and continue the story.
            3. Mentor: Give feedback and points.
            [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        // Call AI with timeout to prevent server hang
        const rawResponse = await callGroq(messages, 0.7);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 5 };
        } 
        catch (e) {
            parsedData = { conversation: "Let's continue.", learning_note: "চালিয়ে যান।", score_added: 5 }; 
        }

        // 🛡️ Fail-safe
        if (!parsedData.conversation) parsedData.conversation = "Tell me more!";
        if (!parsedData.learning_note) parsedData.learning_note = "মাশাআল্লাহ, চালিয়ে যান।";

        // 🛑 SCORE UPDATE LOGIC
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
        res.json({ reply: "Network hiccup.", instruction: "নেটওয়ার্ক সমস্যা, আবার চেষ্টা করুন।" });
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
        // Added timeout of 20 seconds
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.1-8b-instant", 
            max_tokens: 1024,
            temperature: temp,
            response_format: { type: "json_object" }
        }, { 
            headers: { "Authorization": `Bearer ${apiKey}` },
            timeout: 20000 
        });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Service Failed or Timed Out"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Master Engine running on port ${PORT}`));
