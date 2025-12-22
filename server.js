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
    locations: ["Toy Shop", "Ice Cream Van", "School Playground", "Zoo", "Grandma's House", "Cartoon World", "Chocolate Factory"],
    characters: ["A Friendly Rabbit", "The Ice Cream Man", "Your Best Friend", "A Talking Cat", "Grandmother", "A Funny Clown"],
    crises: ["You want a blue candy", "You lost your ball", "You want to play", "You are hungry", "You made a drawing"]
};

const ADULT_WORLD = {
    locations: ["Dhaka Metro Rail", "Corporate Office", "Airport Immigration", "Hospital", "Job Interview Board", "Fancy Restaurant", "Police Station"],
    characters: ["A Strict Officer", "An Impatient Boss", "A Foreign Client", "A Doctor", "A Taxi Driver", "Hotel Receptionist"],
    crises: ["You lost your wallet", "You are late for a meeting", "Negotiating a salary", "Explaining a mistake", "Booking a flight", "Complaining about service"]
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

// 💬 API: CHAT (CONTEXT AWARE & EXPERT METHODOLOGY)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
    // Extract Skill
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    // Initialize DB with history array if missing
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill, history: [] };
    if (!db[userId].history) db[userId].history = [];

    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    
    // If starting fresh, clear history logic for a new scenario
    if (isStart) db[userId].history = [];

    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;

    // 🔥 1. SELECT WORLD
    let world = (userSkill === 'A' || userSkill === 'B') ? KIDS_WORLD : ADULT_WORLD;

    // 🔥 2. GENERATE SCENARIO
    let generatedScenario = "";
    if (isStart) {
        generatedScenario = `
        [NEW SCENARIO]
        - Location: ${pick(world.locations)}
        - Character: ${pick(world.characters)}
        - Conflict/Goal: ${pick(world.crises)}
        `;
    }

    // 🔥 3. EXPERT TEACHING METHODOLOGY (Based on Meeting Report)
    let methodology = "";
    let complexity = "";
    let mentorPersona = "";

    switch(userSkill) {
        case 'A': // Beginner (Kids)
            methodology = "METHODOLOGY: 'Play-Based Learning' (Montessori). Focus on visual words. No grammar rules. Repetition is key.";
            complexity = "ACTOR RULE: Use max 3-4 word sentences. E.g., 'I want apple'. Be playful.";
            mentorPersona = "MENTOR RULE: You are a Guardian/Big Brother. Use 'Tumi' (তুমি). Tone: Super affectionate & protective.";
            break;
        case 'B': // Learner (School)
            methodology = "METHODOLOGY: 'Scaffolding'. Build on what user says. Gentle correction. Focus on meaning first.";
            complexity = "ACTOR RULE: Simple daily sentences. Clear articulation.";
            mentorPersona = "MENTOR RULE: You are a Friendly Guide. Use 'Tumi' (তুমি). Tone: Encouraging.";
            break;
        case 'C': // Hesitant
            methodology = "METHODOLOGY: 'Psychological Safety'. Lower the affective filter. Validate before correcting.";
            complexity = "ACTOR RULE: Intermediate English. Be patient. Give user time to think.";
            mentorPersona = "MENTOR RULE: You are a Supporter. Use 'Apni' (আপনি). Tone: Respectful, soft, removing fear.";
            break;
        case 'D': // IELTS
            methodology = "METHODOLOGY: 'Academic Rigor' & 'Socratic Method'. Challenge the user's logic and vocabulary.";
            complexity = "ACTOR RULE: Use complex structures, formal vocabulary.";
            mentorPersona = "MENTOR RULE: You are a Strict Coach. Use 'Apni' (আপনি). Tone: Professional, demanding precision.";
            break;
        case 'E': // Professional
            methodology = "METHODOLOGY: 'Task-Based Learning (TBL)'. Focus on outcome, efficiency, and business etiquette.";
            complexity = "ACTOR RULE: Use idioms, corporate slang, fast pace.";
            mentorPersona = "MENTOR RULE: You are a Corporate Consultant. Use 'Apni' (আপনি). Tone: Efficient, direct, result-oriented.";
            break;
    }

    // 🔥 4. CONTEXT HISTORY BUILDER
    // Retrieve last 3 exchanges (6 messages) to maintain flow
    const historyContext = db[userId].history.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Actor'}: "${h.content}"`).join('\n');

    try {
        let finalPrompt = "";
        
        const masterPrompt = `
        [SYSTEM ROLE]
        You are "Talk24AI", an Context-Aware English Training Engine.
        
        [CURRENT SETTINGS]
        - Skill Level: ${userSkill}
        - Teaching Strategy: ${methodology}
        
        [CONTEXT HISTORY (Last 3 turns)]
        ${historyContext || "No history yet. Starting new."}

        [PROTOCOL: TWO AGENTS]
        
        1. AGENT A (THE ACTOR):
           - Role: Roleplay the character in the current scenario.
           - Language: ENGLISH ONLY.
           - **Rule**: ${complexity}
           - **Memory**: Look at [CONTEXT HISTORY]. Do not repeat questions you just asked. React to the user's last reply logically.
           - Identity: Practicing Muslim background (uses Islamic greetings appropriately).
        
        2. AGENT B (THE MENTOR):
           - Language: BANGLA SCRIPT (বাংলা).
           - **Persona**: ${mentorPersona}
           - **SCORING ALGORITHM (STRICT)**:
             1. **Relevance Check**: Does the user's reply fit the [CONTEXT HISTORY] and current Scenario?
             2. **Grammar Check**: Is the English understandable?
             3. **Scoring**:
                - IF (Relevant + Understandable) -> Score 10.
                - IF (Irrelevant OR Gibberish) -> Score 0.
             - **Feedback**: If Score is 0, explain WHY (e.g., "We are at a shop, why are you talking about swimming?").
        
        [OUTPUT JSON FORMAT]:
        {
            "conversation": "Actor's reply in English (advancing the story)...",
            "learning_note": "Mentor's feedback in Bangla...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: STARTING NEW SESSION.
            ${generatedScenario}
            [TASK]: 
            1. Actor: Start the roleplay based on the Location/Character.
            2. Mentor: Explain the scenario in Bangla according to the Methodology.
            [JSON REQUIRED]`;
        } else {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: ONGOING CONVERSATION.
            [USER SAID]: "${message}"
            [TASK]:
            1. Check Relevance with Context History.
            2. Actor: Reply logically.
            3. Mentor: Judge and Guide.
            [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        const rawResponse = await callGroq(messages, 0.7);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 5 };
        } 
        catch (e) {
            parsedData = { conversation: "I'm listening.", learning_note: "চালিয়ে যান।", score_added: 5 }; 
        }

        // Fail-safe
        if (!parsedData.conversation) parsedData.conversation = "Tell me more.";
        if (!parsedData.learning_note) parsedData.learning_note = "মাশাআল্লাহ, চালিয়ে যান।";

        // 🛑 SAVE HISTORY & SCORE
        // Push current exchange to history
        db[userId].history.push({ role: 'user', content: message });
        db[userId].history.push({ role: 'assistant', content: parsedData.conversation });
        
        // Trim history to keep DB size manageable (last 10 messages max)
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
        res.json({ reply: "Connection unstable.", instruction: "নেটওয়ার্ক সমস্যা, আবার বলুন।" });
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
    } catch (err) { throw new Error("AI Service Failed or Timed Out"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Intelligent Engine running on port ${PORT}`));
