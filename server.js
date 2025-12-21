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

// 🛡️ CRASH PROOF UTILS
const safeString = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const cleanUnicode = (str) => {
    const s = safeString(str); 
    return s.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
};

const sanitizeInput = (text) => {
    const s = safeString(text);
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

// 💬 API: CHAT
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    
    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
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

        const guardRails = `
        [SYSTEM PROTOCOL]
        
        [AGENT A: ROLEPLAY ACTOR]
        - **Language:** STRICTLY ENGLISH ONLY. If user speaks Bangla, reply in English: "Please speak in English."
        - **Behavior:** Act exactly as the character. 
        - **Safety:** If topic is romance/nsfw -> Pivot immediately to a boring topic (Weather/Study).

        [AGENT B: MENTOR]
        - **Language:** STRICTLY BANGLA SCRIPT.
        - **Format:** 1. **পর্যালোচনা:** (Review mistake/praise)
          2. **সঠিক রূপ:** (Correct sentence)
          3. **পরবর্তী ধাপ:** (Ask a new question)
        
        [JSON OUTPUT ONLY]:
        {
            "conversation": "English reply...",
            "learning_note": "Bangla feedback..."
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [TASK]: Start conversation energetically.
            [JSON]: {"conversation": "Hello! Ready?", "learning_note": "আসসালামু আলাইকুম!"}
            `;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [USER SAID]: "${message}"
            [JSON]: {"conversation": "...", "learning_note": "..."}
            `;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            } else {
                parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।" };
            }
        } 
        catch (e) {
            console.error("JSON Parse Fail:", rawResponse);
            parsedData = { 
                conversation: safeString(rawResponse).replace(/["{}]/g, ''), 
                learning_note: "যান্ত্রিক ত্রুটি, তবে প্র্যাকটিস চালিয়ে যান।" 
            }; 
        }

        if (!parsedData.conversation || parsedData.conversation.length < 2) parsedData.conversation = "I am listening...";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("HANDLED ERROR:", err.message);
        res.json({ 
            reply: "Server connected. Please say that again.", 
            instruction: "নেটওয়ার্ক কানেকশন ঠিক হয়েছে। আবার বলুন।" 
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
        
        // 🔥 FIXED MODEL: Using Llama 3.1 8B Instant (Currently Supported & Fast)
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.1-8b-instant", 
            max_tokens: 1024,
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
