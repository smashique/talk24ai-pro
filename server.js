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
    locations: ["Magic Toy Shop", "Ice Cream Park", "School Recess", "Zoo with Talking Animals", "Grandma's Kitchen", "Cartoon Land"],
    characters: ["Mr. Rabbit", "The Ice Cream Uncle", "Your Best Friend", "Grandma", "A Funny Clown"],
    crises: ["You want the red balloon", "You dropped your ice cream", "You want to play hide and seek", "You are showing a drawing"]
};

const ADULT_WORLD = {
    locations: ["Dhaka Metro Station", "Tech Company Office", "Immigration Desk", "Doctor's Chamber", "Job Interview", "Coffee Shop"],
    characters: ["Busy Officer", "Strict Boss", "Visa Officer", "Specialist Doctor", "Hiring Manager"],
    crises: ["Wallet missing", "Running late for meeting", "Negotiating salary", "Explaining medical symptoms", "Booking a ticket"]
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

// 💬 API: CHAT (HUMANIZER ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
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
        [SCENARIO LAUNCH]
        - Setting: ${pick(world.locations)}
        - Character: ${pick(world.characters)}
        - Situation: ${pick(world.crises)}
        `;
    }

    // 🔥 3. HUMANIZER RULES (PSYCHOLOGY + LINGUISTICS)
    let complexityRules = "";
    let mentorPersona = "";

    switch(userSkill) {
        case 'A': // Kid
            complexityRules = "English: Simple words. Use emojis. Sound excited or curious. Use fillers like 'Wow!', 'Oh no!'.";
            mentorPersona = "Bangla: You are a loving 'Boro Bhai/Apu'. Use 'Tumi' (তুমি). Say things like 'আরে দারুণ!', 'শোনো বাবু...', 'ভয় পেও না'।";
            break;
        case 'B': // Learner
            complexityRules = "English: Casual, daily language. Be patient.";
            mentorPersona = "Bangla: Use 'Tumi' (তুমি). Supportive friend. Use phrases like 'চেষ্টাটা চমৎকার ছিল', 'একটু ভুল হয়েছে, তাতে কি?'।";
            break;
        case 'C': // Hesitant
            complexityRules = "English: Polite, encouraging. Give space.";
            mentorPersona = "Bangla: Use 'Apni' (আপনি). Respectful Guide. Focus on confidence building.";
            break;
        case 'D': // IELTS
            complexityRules = "English: Academic, logical, structured.";
            mentorPersona = "Bangla: Use 'Apni' (আপনি). Professional Coach. Precise feedback.";
            break;
        case 'E': // Pro
            complexityRules = "English: Corporate, direct, outcome-focused.";
            mentorPersona = "Bangla: Use 'Apni' (আপনি). Corporate Mentor. No fluff.";
            break;
    }

    const contextLog = db[userId].history.slice(-6).map(h => `${h.role}: ${h.content}`).join("\n");

    try {
        let finalPrompt = "";
        
        const masterPrompt = `
        [SYSTEM ROLE]
        Act as "Talk24AI", a 100% Human-Like Conversational Partner.
        
        [CONTEXT]
        - Skill Level: ${userSkill}
        - History: 
        ${contextLog}

        [AGENTS PROTOCOL]
        
        1. AGENT A (THE ACTOR) - English Only:
           - **HUMAN TRAIT**: Do not sound robotic. Use fillers ("Umm", "Well", "Actually"). Show Emotion (Anger, Happiness, Confusion).
           - **Rule**: ${complexityRules}
           - **Memory**: React to what the user JUST said. If they ask a question, answer it. If they are wrong, act confused naturally (e.g., "Huh? What do you mean?").
        
        2. AGENT B (THE MENTOR) - Bangla Only:
           - **HUMAN TRAIT**: Do not translate like a machine. Speak naturally.
           - **Persona**: ${mentorPersona}
           - **JUDGMENT (Strict but Kind)**:
             - RELEVANCE: Did the user answer the Actor? (Yes/No)
             - MEANING: Is the English understandable? (Yes/No)
           - **SCORING**: Give 10 points ONLY if both are Yes. Else 0.
           - **FEEDBACK STYLE**: 
             - If Score 10: "মাশাআল্লাহ! খুব সুন্দর বলেছেন।" -> Then explain WHY it was good.
             - If Score 0: "আহা! একটু ভুল হয়ে গেল।" -> Then gently correct it. Don't be rude.
        
        [OUTPUT JSON]:
        {
            "conversation": "Actor's human-like line...",
            "learning_note": "Mentor's natural Bangla feedback...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `${masterPrompt} [TASK]: Start the scenario warmly. Mentor sets the mood. [JSON REQUIRED]`;
        } else {
            finalPrompt = `${masterPrompt} [USER SAID]: "${message}" [TASK]: React naturally. Judge fairly. [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        // Temperature 0.8 for more natural/creative variation
        const rawResponse = await callGroq(messages, 0.8);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 5 };
        } 
        catch (e) {
            parsedData = { conversation: "Oh, I missed that. Can you say it again?", learning_note: "দুঃখিত, বুঝতে পারিনি। আবার বলুন।", score_added: 0 }; 
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
        res.json({ reply: "Network glitch.", instruction: "নেটওয়ার্ক সমস্যা।" });
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
        }, { headers: { "Authorization": `Bearer ${apiKey}` }, timeout: 25000 });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Service Failed"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Human Engine running on port ${PORT}`));
