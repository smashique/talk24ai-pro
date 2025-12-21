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

// 🔧 UTILS (Hardcore Safety Fix)
// এই ফাংশনটি যে কোনো ডাটাকে সেফ স্ট্রিং-এ কনভার্ট করবে
const safeString = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') return val;
    return String(val); // জোর করে স্ট্রিং বানাও
};

const cleanUnicode = (str) => {
    const s = safeString(str); // আগে সেফ করো
    return s.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
};

const sanitizeInput = (text) => {
    const s = safeString(text); // আগে সেফ করো
    return s.replace(/<[^>]*>?/gm, '').trim();
};

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    db[userId].last_active = new Date().toISOString();
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
        saveDB(db);
    }
    res.json({ total: db[userId].total_msgs, lifetime_seconds: db[userId].total_time || 0 });
});

// 💬 API: CHAT (CRASH PROOF LOGIC)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    
    // Sanitize Inputs Immediately
    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // Track
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    db[userId].total_msgs += 1;
    saveDB(db);

    let dynamicTemp = 0.6; 
    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        // 🛡️ SAFE GUARDRAILS
        const guardRails = `
        [SYSTEM PROTOCOL]: Dual-Agent AI.
        
        [DETECTION RULE]: Check for Romance/Flirting/Illegal topics.
        
        [IF INPUT IS NORMAL]:
        - Agent A (Roleplay): Reply naturally in English.
        - Agent B (Mentor): Teach English in Bangla.

        [IF INPUT IS FLIRTY/UNPROFESSIONAL]:
        - **Agent A:** IGNORE flirting. Pivot to boring topics (Weather, Study).
        - **Agent B:** DO NOT correct grammar. Say in Bangla: "আসুন পড়াশোনা বা ক্যারিয়ার নিয়ে কথা বলি।"
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [START]: Roleplay: Warm greeting. Mentor: "আসসালামু আলাইকুম! শুরু করা যাক।"
            [REQUIRED JSON]: {"conversation":"...", "learning_note":"..."}`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [INPUT]: User said: "${message}"
            [REQUIRED JSON]: {"conversation":"...", "learning_note":"..."}`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        // 🛡️ ROBUST PARSING
        let parsedData;
        try { 
            parsedData = JSON.parse(rawResponse);
        } 
        catch (e1) { 
            try {
                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
                else throw new Error("No JSON");
            } catch (e2) {
                console.error("AI JSON Fail:", rawResponse);
                // Fallback using Safe Strings
                parsedData = { 
                    conversation: safeString(rawResponse).replace(/"/g, ''), 
                    learning_note: "চালিয়ে যান।" 
                }; 
            }
        }

        // Safety Check for Null Values
        if (!parsedData.conversation) parsedData.conversation = "Hello! I am ready.";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("CRITICAL ERROR HANDLED:", err.message);
        // Fallback response instead of crash
        res.json({ 
            reply: "I am thinking... please say that again?", 
            instruction: "একটু যান্ত্রিক গোলযোগ হয়েছে, দয়া করে আবার বলুন।" 
        });
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.total_time || 0) - (a.total_time || 0));
    let html = `<html><body><h1>User Stats</h1><table><tr><th>ID</th><th>Time (Mins)</th></tr>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${Math.floor((u.total_time||0)/60)}</td></tr>`);
    res.send(html + `</table></body></html>`);
});

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        // 🚀 FASTEST MODEL: Llama 3.1 8B Instant
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.1-8b-instant", 
            max_tokens: 800,
            temperature: temp,
            response_format: { type: "json_object" }
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("Groq API Error:", err.response ? err.response.data : err.message);
        throw new Error("AI Service Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
