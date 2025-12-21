const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DB_FILE = path.join(__dirname, 'user_db.json');

// 🛠️ LOAD/SAVE DATABASE
const loadDB = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; } };
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const cleanUnicode = (str) => str ? str.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))) : "";
const sanitizeInput = (text) => typeof text === 'string' ? text.replace(/<[^>]*>?/gm, '').trim() : '';

// ⏱️ API: UPDATE TIME (Saves Time to DB)
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    }
    
    // Add new seconds to total time
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    db[userId].last_active = new Date().toISOString();
    
    saveDB(db);
    res.json({ success: true, total_time: db[userId].total_time });
});

// 📊 API: GET STATS (Includes Lifetime Time)
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString(), last_active: new Date().toISOString() };
        saveDB(db);
    }

    res.json({ 
        total: db[userId].total_msgs,
        lifetime_seconds: db[userId].total_time || 0 
    });
});

// 💬 API: CHAT
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    message = sanitizeInput(message);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // Track Message Count
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    db[userId].total_msgs += 1;
    db[userId].last_active = new Date().toISOString();
    saveDB(db);

    let dynamicTemp = 0.5;
    if (mood.toLowerCase().includes('fun')) dynamicTemp = 0.8;
    const isStart = message === "Action!";

    try {
        let finalPrompt = "";
        
        // MENTOR & ROLEPLAY LOGIC
        const commonRules = `
        [AGENT A - ROLEPLAY]: English ONLY. Natural conversation.
        [AGENT B - MENTOR]: Bangla ONLY. Review user's English. Teach nicely. If lazy -> Scold ("Time is Life").
        `;

        if (isStart) {
            finalPrompt = `${systemInstruction} ${commonRules} [START]: Roleplay: Greetings (English). Mentor: "আসসালামু আলাইকুম! সময় হলো জীবন। শুরু করি?" (Bangla). [JSON]: {"conversation":"...", "learning_note":"..."}`;
        } else {
            finalPrompt = `${systemInstruction} ${commonRules} [INPUT]: "${message}". [JSON]: {"conversation":"...", "learning_note":"..."}`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try { parsedData = JSON.parse(rawResponse.replace(/```json|```/g, '').trim()); } 
        catch { parsedData = { conversation: "I am ready.", learning_note: "নেটওয়ার্ক সমস্যা।" }; }

        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) parsedData.conversation = "Hello! I am ready.";

        res.json({ reply: cleanUnicode(parsedData.conversation), instruction: cleanUnicode(parsedData.learning_note) });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.status(500).json({ reply: "Connection error.", instruction: "Try again." });
    }
});

// 👑 ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total_msgs - a.total_msgs);
    let html = `<html><head><title>Admin</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:10px}th{background:#58cc02;color:white}</style></head><body><h1>User Stats</h1><table><tr><th>ID</th><th>Msgs</th><th>Lifetime Time</th><th>Last Active</th></tr>`;
    
    users.forEach(u => {
        const mins = Math.floor((u.total_time || 0) / 60);
        html += `<tr><td>${u.id}</td><td>${u.total_msgs}</td><td>${mins} mins</td><td>${new Date(u.last_active).toLocaleString()}</td></tr>`;
    });
    
    html += `</table></body></html>`;
    res.send(html);
});

async function callGroq(messages, temp) {
    try {
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages, model: "llama-3.3-70b-versatile", max_tokens: 850, temperature: temp, response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}` } });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Failed"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Database Server running on http://localhost:${PORT}`));
