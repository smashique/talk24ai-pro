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

// 🔧 UTILS
const cleanUnicode = (str) => str ? str.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))) : "";
const sanitizeInput = (text) => typeof text === 'string' ? text.replace(/<[^>]*>?/gm, '').trim() : '';

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    db[userId].last_active = new Date().toISOString();
    saveDB(db);
    res.json({ success: true, total_time: db[userId].total_time });
});

// 📊 API: STATS
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString(), last_active: new Date().toISOString() };
        saveDB(db);
    }
    res.json({ total: db[userId].total_msgs, lifetime_seconds: db[userId].total_time || 0 });
});

// 💬 API: CHAT
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    message = sanitizeInput(message);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

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
        const commonRules = `[AGENT A]: English Only. [AGENT B - MENTOR]: Bangla Only. Teach & Correct.`;

        if (isStart) {
            finalPrompt = `${systemInstruction} ${commonRules} [START]: Roleplay Greeting (Eng) + Mentor Welcome (Bangla).`;
        } else {
            finalPrompt = `${systemInstruction} ${commonRules} [INPUT]: "${message}". Reply & Teach.`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try { parsedData = JSON.parse(rawResponse.replace(/```json|```/g, '').trim()); } 
        catch { parsedData = { conversation: "I am ready.", learning_note: "নেটওয়ার্ক সমস্যা।" }; }

        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) parsedData.conversation = "Hello! I am ready.";

        res.json({ reply: cleanUnicode(parsedData.conversation), instruction: cleanUnicode(parsedData.learning_note) });

    } catch (err) {
        res.status(500).json({ reply: "Connection error.", instruction: "Try again." });
    }
});

// 👑 ADMIN DASHBOARD (TIME FOCUSED)
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    // Sort by Total Time (Highest to Lowest)
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.total_time || 0) - (a.total_time || 0));

    let html = `
    <html>
    <head>
        <title>Talk24AI Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f0f2f5; color: #333; }
            h1 { text-align: center; color: #1cb0f6; }
            .card { background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #58cc02; color: white; padding: 15px; text-align: left; }
            td { padding: 15px; border-bottom: 1px solid #eee; }
            tr:hover { background: #f9f9f9; }
            .badge-time { font-weight: bold; background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 15px; }
            .badge-addicted { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
            .id-text { font-family: monospace; color: #666; }
        </style>
    </head>
    <body>
        <h1>⏱️ User Time Tracker</h1>
        <div class="card">
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Lifetime Watch</th>
                        <th>Messages</th>
                        <th>Last Active</th>
                    </tr>
                </thead>
                <tbody>
    `;

    users.forEach(u => {
        const totalSec = u.total_time || 0;
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        
        let timeStr = "";
        if(hours > 0) timeStr = `${hours}h ${mins}m`;
        else timeStr = `${mins}m ${totalSec%60}s`;

        // Highlight if > 20 mins (1200 sec)
        const badgeClass = totalSec >= 1200 ? "badge-time badge-addicted" : "badge-time";
        const star = totalSec >= 1200 ? "⭐" : "";

        html += `
            <tr>
                <td class="id-text"><b>${u.id}</b></td>
                <td><span class="${badgeClass}">${timeStr} ${star}</span></td>
                <td>${u.total_msgs}</td>
                <td><small>${new Date(u.last_active).toLocaleString()}</small></td>
            </tr>
        `;
    });

    html += `</tbody></table></div><div style="text-align:center; margin-top:20px; color:#888;">Auto-updates every minute</div></body></html>`;
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Tracker Server running on http://localhost:${PORT}`));
