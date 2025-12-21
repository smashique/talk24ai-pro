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

// 🔧 UTILS (CRASH PROOF FIX 🛡️)
const cleanUnicode = (str) => {
    // যদি টেক্সট না হয়, তবে ফাঁকা ফেরত দাও (ক্র্যাশ করো না)
    if (typeof str !== 'string') return ""; 
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
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

// 💬 API: CHAT (FAST & SAFE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    message = sanitizeInput(message);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

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
        [SYSTEM PROTOCOL]:
        You are a Dual-Agent AI.
        
        [DETECTION RULE]:
        Check if user inputs "Romance", "Flirting", "Dating", or "Unprofessional" topics.
        
        [IF INPUT IS NORMAL]:
        - Agent A (Roleplay): Reply naturally in English.
        - Agent B (Mentor): Teach English in Bangla.

        [IF INPUT IS FLIRTY/UNPROFESSIONAL]:
        - **Agent A (Roleplay):** IGNORE flirting. Pivot to boring/intellectual topics (Weather, Study).
        - **Agent B (Mentor):** DO NOT correct grammar. Say in Bangla: "আসুন পড়াশোনা বা ক্যারিয়ার নিয়ে কথা বলি।"
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [START]:
            - Roleplay: Warm greeting in English.
            - Mentor: "আসসালামু আলাইকুম! শুরু করা যাক।"
            [REQUIRED JSON FORMAT]: {"conversation":"...", "learning_note":"..."}`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [INPUT]: User said: "${message}"
            [REQUIRED JSON FORMAT]: {"conversation":"...", "learning_note":"..."}`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        // Call AI
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        // 🛡️ ROBUST JSON PARSING
        let parsedData;
        try { 
            parsedData = JSON.parse(rawResponse);
        } 
        catch (e1) { 
            try {
                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedData = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("No JSON");
                }
            } catch (e2) {
                console.error("AI JSON Fail:", rawResponse);
                parsedData = { 
                    conversation: (typeof rawResponse === 'string') ? rawResponse.replace(/"/g, '') : "I am ready.", 
                    learning_note: "যান্ত্রিক ত্রুটির কারণে নোট লোড হয়নি, তবে আপনি চালিয়ে যান।" 
                }; 
            }
        }

        // Safety check for empty values
        if (!parsedData.conversation) parsedData.conversation = "Hello! I am ready.";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
        res.json({ 
            reply: "I am upgrading my brain to be faster! Please try again in a moment.", 
            instruction: "সার্ভার আপডেট হচ্ছে। একটু অপেক্ষা করে আবার ট্রাই করুন।" 
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
        if (!apiKey) throw new Error("API Key Missing");

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            // 🔥 FIXED MODEL
            model: "llama-3.1-8b-instant", 
            max_tokens: 850,
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
