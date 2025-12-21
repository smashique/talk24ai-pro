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
const cleanUnicode = (str) => {
    if (!str) return "";
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

// 📊 STATS API
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, first_seen: new Date().toISOString(), last_active: new Date().toISOString() };
        saveDB(db);
    }
    res.json({ total: db[userId].total_msgs });
});

// 💬 CHAT API (UPDATED MENTOR LOGIC)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // Tracking
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, first_seen: new Date().toISOString() };
    db[userId].total_msgs += 1;
    db[userId].last_active = new Date().toISOString();
    saveDB(db);

    let dynamicTemp = 0.5;
    if (mood.toLowerCase().includes('fun')) dynamicTemp = 0.8;

    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        // 🧠 SUPER PROMPT: STRICT LANGUAGE & TEACHING MODE
        const commonRules = `
        [AGENT A - ROLEPLAY CHARACTER]:
        - You are the actor (Teacher/Shopkeeper/etc).
        - Language: ENGLISH ONLY. Never use Bangla here.
        - Act naturally. If user talks about Atheism/Music/Fahisha, politely change topic in English.

        [AGENT B - MENTOR (Saifur Sir + Hidden Scholar)]:
        - Language: **MUST BE IN BANGLA SCRIPT (বাংলা)**. Use English words only for examples.
        - **MANDATORY STRUCTURE**:
          1. **Review:** Briefly analyze user's last sentence in Bangla (e.g., "আপনার বাক্যটি সঠিক, তবে...").
          2. **Teach:** Teach a grammar rule or better vocabulary related to the context.
          3. **Next Step:** Suggest what to say next in Bangla (e.g., "এখন আপনি জিজ্ঞেস করতে পারেন...").
        - **LATENT PERSONA:** If user is lazy/rude/wasting time, scold gently in Bangla using "Time is Life" logic. Otherwise, be a helpful teacher.
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${commonRules}
            
            [CRITICAL]: User just started.
            - Roleplay Output: Generate a warm English greeting.
            - Mentor Output: "আসসালামু আলাইকুম! সময় হলো জীবন। তাই এক মুহূর্তও নষ্ট না করে চলো প্র্যাকটিস শুরু করি। আমি আছি আপনার সাথে।"
            
            [OUTPUT JSON]: { "conversation": "...", "learning_note": "..." }`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${commonRules}
            
            [INPUT]: User said: "${message}"
            
            [TASK]:
            1. Roleplay Agent: Reply to the user in English.
            2. Mentor Agent: Analyze "${message}". Did they make a mistake? Can it be improved? Write feedback in BANGLA.
            
            [OUTPUT JSON]: { "conversation": "...", "learning_note": "..." }`;
        }

        const messages = [
            { role: "system", content: finalPrompt },
            { role: "user", content: isStart ? "Start conversation" : message }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            parsedData = { 
                conversation: "I am ready. Shall we continue?", 
                learning_note: "যান্ত্রিক ত্রুটির কারণে নোট লোড হয়নি, তবে আপনি চালিয়ে যান!" 
            };
        }

        // Fallback for empty start
        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) {
            parsedData.conversation = "Hello! I'm here. How can I help you today?";
        }

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ reply: "Connection error.", instruction: "আবার চেষ্টা করুন।" });
    }
});

// 👑 ADMIN ROUTE
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total_msgs - a.total_msgs);
    let html = `<html><head><title>Admin</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:10px}</style></head><body><h1>User Stats</h1><table><tr><th>ID</th><th>Msgs</th><th>Last Active</th></tr>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${u.total_msgs}</td><td>${new Date(u.last_active).toLocaleString()}</td></tr>`);
    html += `</table></body></html>`;
    res.send(html);
});

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile",
            max_tokens: 850,
            temperature: temp,
            response_format: { type: "json_object" }
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        throw new Error("AI Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Server running on http://localhost:${PORT}`));
