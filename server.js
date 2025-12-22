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

// 💬 API: CHAT (STRICT CONTEXT ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
    // Extract Skill
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    // Ensure history exists
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill, history: [] };
    if (!Array.isArray(db[userId].history)) db[userId].history = [];

    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    if (isStart) db[userId].history = []; // Reset history on new start

    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;

    // 🔥 1. SELECT WORLD
    let world = (userSkill === 'A' || userSkill === 'B') ? KIDS_WORLD : ADULT_WORLD;

    // 🔥 2. GENERATE SCENARIO
    let generatedScenario = "";
    if (isStart) {
        generatedScenario = `
        [NEW SCENARIO START]
        - Location: ${pick(world.locations)}
        - Character: ${pick(world.characters)}
        - Conflict/Topic: ${pick(world.crises)}
        `;
    }

    // 🔥 3. DEFINE STRICT RULES
    let toneInstruction = "";
    if (userSkill === 'A' || userSkill === 'B') {
        toneInstruction = "MENTOR: Treat user as a CHILD. Use 'Tumi' (তুমি). Be affectionate but correct them like a teacher.";
    } else {
        toneInstruction = "MENTOR: Treat user as an ADULT. Use 'Apni' (আপনি). Be professional.";
    }

    // 🔥 4. CONTEXT HISTORY (CRITICAL FOR RELEVANCE)
    // We send the last 4 exchanges to the AI so it knows what was just asked.
    const contextLog = db[userId].history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

    try {
        let finalPrompt = "";
        
        const masterPrompt = `
        [SYSTEM ROLE]
        You are "Talk24AI", a Strict English Training Simulator.
        
        [CURRENT STATUS]
        - Skill Level: ${userSkill}
        - Current Context: ${generatedScenario || "Ongoing Conversation"}
        
        [RECENT HISTORY]
        ${contextLog}

        [PROTOCOL: TWO AGENTS]
        
        1. AGENT A (THE ACTOR):
           - Language: ENGLISH ONLY.
           - Role: Stay 100% in character.
           - Logic: If the user replies appropriately, move the story forward. If irrelevant, express confusion (e.g., "Why are you talking about that?").
        
        2. AGENT B (THE MENTOR & JUDGE):
           - Language: BANGLA SCRIPT (বাংলা).
           - Rule: ${toneInstruction}
           
           🚨 [JUDGMENT ALGORITHM - STRICT]:
           step 1: Check RELEVANCE. Does the User's reply answer the Actor's last question?
                   - Example: Actor asked "Do you like the drawing?", User said "He plays football".
                   - Result: IRRELEVANT. Score = 0.
           step 2: Check GRAMMAR/MEANING.
                   - Example: User said "I rice eat".
                   - Result: BROKEN. Score = 0.
           step 3: SCORING.
                   - Only give +10 if BOTH Relevance and Meaning are correct.
                   - Otherwise, Score = 0.
           
           [FEEDBACK INSTRUCTION]:
           - If Score is 0 (Irrelevant): Mentor MUST say in Bangla: "আমরা এখন [Topic] নিয়ে কথা বলছি, অন্য বিষয়ে নয়। (We are talking about X, not Y)."
           - If Score is 0 (Grammar): Mentor MUST correct the sentence.
        
        [OUTPUT JSON FORMAT]:
        {
            "conversation": "Actor's reply (English)...",
            "learning_note": "Mentor's feedback (Bangla)...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${masterPrompt}
            [TASK]: Start the scenario based on the location.
            [JSON REQUIRED]`;
        } else {
            finalPrompt = `
            ${masterPrompt}
            [USER INPUT]: "${message}"
            [TASK]: STRICTLY judge relevance and grammar. Reply accordingly.
            [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        // Lower temperature for stricter logic
        const rawResponse = await callGroq(messages, 0.5);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 0 };
        } 
        catch (e) {
            parsedData = { conversation: "I didn't catch that.", learning_note: "বুঝতে পারিনি, আবার বলুন।", score_added: 0 }; 
        }

        // 🛑 SAVE HISTORY
        db[userId].history.push({ role: 'Actor', content: parsedData.conversation });
        // Keep history limited to last 10 turns
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
        res.json({ reply: "Connection error.", instruction: "নেটওয়ার্ক সমস্যা।" });
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
        }, { 
            headers: { "Authorization": `Bearer ${apiKey}` },
            timeout: 20000 
        });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Service Failed"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Strict Context Engine running on port ${PORT}`));
