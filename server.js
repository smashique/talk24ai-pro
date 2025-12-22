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

// ⏱️ API: UPDATE TIME (Time Tracking Logic maintained)
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_mistakes: 0, total_time: 0 };
    
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS (Updated with Accuracy Calculation)
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, total_mistakes: 0, total_time: 0 };
        saveDB(db);
    }
    
    const total = db[userId].total_msgs || 0;
    const mistakes = db[userId].total_mistakes || 0;
    // Calculate Accuracy: (Correct / Total) * 100
    const accuracy = total === 0 ? 100 : Math.round(((total - mistakes) / total) * 100);

    res.json({ 
        total: total, 
        accuracy: accuracy,
        lifetime_seconds: db[userId].total_time || 0 
    });
});

// 💬 API: CHAT (The New Brain)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    
    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_mistakes: 0, total_time: 0 };
    
    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    saveDB(db);

    // Dynamic Temperature based on context
    let dynamicTemp = 0.6; 

    try {
        let finalPrompt = "";

        // 🧠 SUPER PROMPT: ACTOR + MENTOR + JUDGE
        const guardRails = `
        [SYSTEM PROTOCOL]
        
        [AGENT A: ACTOR]
        - Role: Act strictly according to the 'systemInstruction'.
        - Language: ENGLISH ONLY.
        - Behavior: Natural, friendly, engaging.
        - Safety: Redirect NSFW/Haram topics politely.

        [AGENT B: MENTOR & JUDGE]
        - Language: BANGLA SCRIPT (বাংলা).
        - Persona: Skilled Professional & Practicing Muslim. Friendly, encouraging.
        - **JUDGMENT TASK:** Check user's input for grammar/vocab errors.
          - If error found: Set "has_mistake": true
          - If correct: Set "has_mistake": false
        - **FEEDBACK STRUCTURE:**
          1. Review (Analyze the mistake or praise accuracy).
          2. Correction (Show the right way).
          3. Next Step (Suggest what to say next to keep conversation going).
        
        [OUTPUT FORMAT - JSON ONLY]:
        {
            "conversation": "English reply from Actor...",
            "learning_note": "Bangla feedback from Mentor...",
            "has_mistake": true/false
        }
        `;

        if (isStart) {
            finalPrompt = `${systemInstruction} ${guardRails} [TASK]: Start the conversation warmly. [JSON REQUIRED]`;
        } else {
            finalPrompt = `${systemInstruction} ${guardRails} [USER SAID]: "${message}" [TASK]: Reply, Teach & Judge. [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        // AI Call
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        // Response Parsing
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", has_mistake: false };
        } 
        catch (e) {
            parsedData = { conversation: safeString(rawResponse).replace(/["{}]/g, ''), learning_note: "চালিয়ে যান।", has_mistake: false }; 
        }

        if (!parsedData.conversation) parsedData.conversation = "I am listening...";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        // 🛑 SCORING LOGIC: Update Mistakes in DB
        if (!isStart && parsedData.has_mistake === true) {
            db[userId].total_mistakes += 1;
            saveDB(db);
        }

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note),
            has_mistake: parsedData.has_mistake // Send to frontend for Popup Logic
        });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.json({ reply: "Connection stabilized. Say again.", instruction: "কানেকশন ঠিক হয়েছে। আবার বলুন।" });
    }
});

// 👑 ADMIN DASHBOARD (Updated to show Mistakes & Time)
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.total_time || 0) - (a.total_time || 0));
    
    let html = `
    <html>
    <head><title>Admin Stats</title><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#58cc02;color:white}</style></head>
    <body>
        <h1>User Statistics</h1>
        <table>
            <tr><th>User ID</th><th>Messages</th><th>Mistakes</th><th>Time (Mins)</th></tr>
    `;
    
    users.forEach(u => {
        html += `<tr>
            <td>${u.id}</td>
            <td>${u.total_msgs}</td>
            <td>${u.total_mistakes || 0}</td>
            <td>${Math.floor((u.total_time || 0) / 60)}</td>
        </tr>`;
    });
    
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
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
