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

// 🌍 SEPARATE WORLDS
const KIDS_WORLD = {
    locations: ["Toy Shop", "Ice Cream Van", "School Playground", "Zoo", "Grandma's House", "Cartoon World"],
    characters: ["A Friendly Rabbit", "The Ice Cream Man", "Your Best Friend", "Grandmother", "A Funny Clown"],
    crises: ["You want a blue candy", "You lost your ball", "You want to play", "You are hungry", "Show your drawing"]
};

const ADULT_WORLD = {
    locations: ["Corporate Office", "Airport Immigration", "Hospital", "Job Interview", "Restaurant", "Police Station"],
    characters: ["Strict Officer", "Impatient Boss", "Foreign Client", "Doctor", "Manager"],
    crises: ["Lost wallet", "Late for meeting", "Negotiating salary", "Explaining mistake", "Booking flight"]
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A', history: [] };
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A', history: [] };
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

// 💬 API: CHAT (FLUENT BANGLA ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
    // Extract Skill
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill, history: [] };
    if (!Array.isArray(db[userId].history)) db[userId].history = [];

    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    if (isStart) db[userId].history = []; 

    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;

    // 🔥 1. SELECT WORLD
    let world = (userSkill === 'A' || userSkill === 'B') ? KIDS_WORLD : ADULT_WORLD;

    // 🔥 2. GENERATE SCENARIO
    let generatedScenario = "";
    if (isStart) {
        generatedScenario = `
        [SCENARIO]
        - Place: ${pick(world.locations)}
        - Person: ${pick(world.characters)}
        - Situation: ${pick(world.crises)}
        `;
    }

    // 🔥 3. DEFINE TONE (LINGUISTIC FIX)
    let complexityRules = "";
    let mentorTone = "";

    switch(userSkill) {
        case 'A': // Kid
            complexityRules = "English: Max 4 simple words. Playful.";
            mentorTone = "Bangla: Use 'Tumi' (তুমি). Speak like an affectionate brother. Example: 'খুব সুন্দর বলেছ!', 'এটা কিন্তু ঠিক হলো না বাবু'।";
            break;
        case 'B': // Learner
            complexityRules = "English: Simple daily sentences.";
            mentorTone = "Bangla: Use 'Tumi' (তুমি). Encouraging. Example: 'চেষ্টা ভালো ছিল', 'বাক্যটা এভাবে বলো'।";
            break;
        case 'C': // Hesitant
            complexityRules = "English: Intermediate.";
            mentorTone = "Bangla: Use 'Apni' (আপনি). Supportive. Example: 'ভয় পাবেন না, আরেকবার চেষ্টা করুন'।";
            break;
        case 'D': // IELTS
            complexityRules = "English: Formal/Academic.";
            mentorTone = "Bangla: Use 'Apni' (আপনি). Professional. Example: 'গ্রামার ঠিক আছে, তবে শব্দচয়ন আরও ভালো হতে পারত'।";
            break;
        case 'E': // Pro
            complexityRules = "English: Business Professional.";
            mentorTone = "Bangla: Use 'Apni' (আপনি). Direct. Example: 'কর্পেোরেট পরিবেশে এভাবে বলাটা উপযুক্ত নয়'।";
            break;
    }

    const contextLog = db[userId].history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

    try {
        let finalPrompt = "";
        
        const masterPrompt = `
        [SYSTEM ROLE]
        You are "Talk24AI".
        
        [CURRENT SETTINGS]
        - Skill: ${userSkill}
        - XP: ${currentLevel}
        - Context: ${generatedScenario || "Ongoing"}
        
        [HISTORY]
        ${contextLog}

        [AGENTS]
        
        1. ACTOR (English Only):
           - Roleplay the character. Be natural. Move story forward.
           - Complexity: ${complexityRules}
        
        2. MENTOR (Bangla Only):
           - **CRITICAL**: Speak STANDARD BANGLA (প্রমিত বাংলা). No dialects. No broken sentences.
           - **Tone**: ${mentorTone}
           - **Task**:
             1. RELEVANCE CHECK: Is the user answering the Actor's last question?
             2. GRAMMAR CHECK: Is the English correct?
             3. FEEDBACK: 
                - If Correct: Give +10 score. Say "মাশাআল্লাহ" or "চমৎকার".
                - If Irrelevant: Score 0. Say: "আমরা এখন [Topic] নিয়ে কথা বলছি। দয়া করে প্রসঙ্গ বজায় রাখুন।"
                - If Grammar Wrong: Score 0. Correct the sentence gently in Bangla.
        
        [OUTPUT JSON]:
        {
            "conversation": "Actor's reply...",
            "learning_note": "Mentor's clear Bangla feedback...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `${masterPrompt} [TASK]: Start scenario. Mentor explains context in clear Bangla. [JSON REQUIRED]`;
        } else {
            finalPrompt = `${masterPrompt} [USER SAID]: "${message}" [TASK]: Judge strict relevance & grammar. Reply clearly. [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        const rawResponse = await callGroq(messages, 0.6);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 5 };
        } 
        catch (e) {
            parsedData = { conversation: "Say that again?", learning_note: "দুঃখিত, বুঝতে পারিনি। আবার বলুন।", score_added: 0 }; 
        }

        db[userId].history.push({ role: 'Actor', content: parsedData.conversation });
        if (db[userId].history.length > 10) db[userId].history = db[userId].history.slice(-10);

        if (!isStart && parsedData.score_added > 0) {
            db[userId].lifetime_score = (db[userId].lifetime_score || 0) + parsedData.score_added;
        }
        saveDB(db);

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note),
            score_added: parsedData.score_added || 0,
            new_total_score: db[userId].lifetime_score
        });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.json({ reply: "Network error.", instruction: "নেটওয়ার্ক সমস্যা।" });
    }
});

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
        }, { headers: { "Authorization": `Bearer ${apiKey}` }, timeout: 20000 });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Service Failed"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Fluent Bangla Engine running on port ${PORT}`));
