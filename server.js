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

const DB_FILE = path.join(__dirname, 'user_db.json');
const loadDB = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; } };
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const safeString = (val) => (val === null || val === undefined) ? "" : String(val);
const cleanUnicode = (str) => safeString(str).replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
const sanitizeInput = (text) => safeString(text).replace(/<[^>]*>?/gm, '').trim();

// 🌍 SEPARATE WORLDS (KIDS VS ADULTS)
const KIDS_WORLD = {
    locations: ["Magic Toy Shop", "The Zoo", "Grandma's Garden", "Chocolate Factory", "Playground"],
    characters: ["A Friendly Rabbit", "Kind Grandmother", "Playful Best Friend", "Ice Cream Man"],
    crises: ["Wanting a blue candy", "Losing a ball", "Asking for help playing", "Showing a colorful drawing"]
};

const ADULT_WORLD = {
    locations: ["Metro Rail Station", "Corporate Office", "Airport Immigration", "Doctor's Consultation Room", "Job Interview Board"],
    characters: ["Strict Officer", "Impatient Manager", "Visa Consultant", "Senior Specialist Doctor"],
    crises: ["Wallet is missing", "Being late for a meeting", "Negotiating a price", "Describing health symptoms"]
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 📊 STATS & TIME MANAGEMENT
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) { db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, history: [] }; saveDB(db); }
    const score = db[userId].lifetime_score || 0;
    const level = Math.floor(score / 1000) + 1;
    res.json({ total: db[userId].total_msgs, score, level, lifetime_seconds: db[userId].total_time || 0 });
});

app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, history: [] };
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 💬 API: CHAT (TOTAL ENGLISH IMMERSION ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userLevel = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, history: [] };
    if (!db[userId].history) db[userId].history = [];

    const isStart = message === "Action!";
    if (isStart) db[userId].history = [];
    else db[userId].total_msgs += 1;

    let world = (['A', 'B'].includes(userLevel)) ? KIDS_WORLD : ADULT_WORLD;
    let scenario = isStart ? `SCENARIO: At ${pick(world.locations)} with ${pick(world.characters)}. Goal: ${pick(world.crises)}` : "Ongoing Simulation";

    // --- EXPERT METHODOLOGIES (ENGLISH ONLY) ---
    let actorRules = "";
    let mentorRules = "";
    if (['A', 'B'].includes(userLevel)) {
        actorRules = "Use max 4-5 simple English words. Sound like a loving character. Use fillers like 'Oh', 'Wow'.";
        mentorRules = "Tone: Loving Elder Sibling. Use simple English. Methodology: Montessori/TPR.";
    } else {
        actorRules = "Use professional and natural English. Be human-like, use 'Well', 'Actually'. Move the story forward.";
        mentorRules = "Tone: Professional English Coach. Methodology: Task-Based Learning (TBL).";
    }

    const context = db[userId].history.slice(-6).map(h => `${h.role}: "${h.content}"`).join("\n");

    try {
        const masteryPrompt = `
        [MASTER ROLE]
        You are a world-class English Training Specialist and a practicing Muslim.
        Think step by step with precision.

        [STRICT INSTRUCTION: ALL ENGLISH]
        BOTH Actor and Mentor MUST speak ONLY English. No Bangla allowed in any part of the response.

        [KEY PROTOCOLS]
        1. ACTOR: Act 100% human. Do not repeat user words. Show emotions and use natural fillers.
        2. MENTOR: Judge strictly. Give 10 XP ONLY if the user's reply is relevant to the scenario and grammatically decent. 
        3. ISLAMIC AKHLAQ: Maintain high moral standards. Use 'Assalamu Alaikum', 'Alhamdulillah', and 'InshaAllah' naturally and wisely.
        4. MENTOR STRUCTURE: The 'learning_note' MUST contain exactly 3 bullet points in clear English:
           • Review of your previous message (corrections/improvements).
           • A Spoken English tip related to our current topic.
           • Instruction for your next move (do not provide the direct answer).

        [SESSION INFO]
        - User Level: ${userLevel}
        - Current Context: ${scenario}
        - Conversation Memory: 
        ${context}

        [OUTPUT JSON FORMAT]
        {
            "conversation": "Actor's natural English reply...",
            "learning_note": "• Review: ... \\n• Tip: ... \\n• Next Step: ...",
            "score_added": 10 or 0
        }`;

        const messages = [
            { role: "system", content: masteryPrompt },
            { role: "user", content: isStart ? "Initiate simulation now." : message }
        ];

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages,
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { 
            headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` },
            timeout: 25000 
        });

        let result = JSON.parse(response.data.choices[0].message.content);

        // Update DB History and Scores
        db[userId].history.push({ role: 'User', content: message });
        db[userId].history.push({ role: 'Actor', content: result.conversation });
        if (db[userId].history.length > 10) db[userId].history = db[userId].history.slice(-10);
        if (!isStart && result.score_added > 0) db[userId].lifetime_score += result.score_added;
        saveDB(db);

        res.json({ 
            reply: cleanUnicode(result.conversation), 
            instruction: cleanUnicode(result.learning_note),
            score_added: result.score_added || 0,
            new_total_score: db[userId].lifetime_score
        });

    } catch (err) { 
        res.json({ 
            reply: "Umm, I missed that. Could you say it again?", 
            instruction: "• Review: Connection was a bit unstable.\\n• Tip: Always keep your sentences short when speaking online.\\n• Next Step: Please try repeating your last sentence." 
        }); 
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.lifetime_score || 0) - (a.lifetime_score || 0));
    let html = `<html><head><title>Admin Stats</title></head><body><h1>User Metrics</h1><table border='1'><tr><th>User ID</th><th>Total Score</th><th>Messages</th></tr>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${u.lifetime_score}</td><td>${u.total_msgs}</td></tr>`);
    res.send(html + `</table></body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Total English Immersion Engine running on port ${PORT}`));
