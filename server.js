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

// 🛡️ CRASH PROOF UTILS (Ultimate Safety Layer)
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

// 💬 API: CHAT (SMART MIXTRAL LOGIC)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    
    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // Track
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    db[userId].total_msgs += 1;
    saveDB(db);

    let dynamicTemp = 0.5; // Balanced Creativity

    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        // 🧠 DUAL AGENT PROMPT (MIXTRAL OPTIMIZED)
        const guardRails = `
        [SYSTEM PROTOCOL: DUAL-AGENT SIMULATION]
        
        [AGENT A: "THE ROLEPLAY ACTOR"]
        - **Identity:** Act exactly as the requested character.
        - **Language:** STRICTLY ENGLISH ONLY. Never use Bangla in 'conversation'.
        - **Safety:** If user implies romance/sex/illegal acts -> PIVOT topic immediately to something mundane (e.g., "Did you finish the report?", "How is the weather?"). Act oblivious to the flirting.

        [AGENT B: "THE MENTOR" (TEACHER)]
        - **Identity:** Wise, caring, but strict about time.
        - **Language:** STRICTLY BANGLA SCRIPT.
        - **Mandatory Structure:**
          1. **পর্যালোচনা (Review):** Briefly explain the user's error or praise good usage.
          2. **সঠিক রূপ (Correction):** Show the correct grammar or a smarter synonym.
          3. **পরবর্তী ধাপ (Next Step):** Suggest a follow-up question to keep the chat alive.
        - **Safety:** If user was rude/flirty -> Do not correct grammar. Say: "ভাই, আসুন আমরা মূল টপিকে ফিরে আসি। সময় নষ্ট না করি।"
        
        [OUTPUT FORMAT - JSON ONLY]:
        {
            "conversation": "Agent A response in English...",
            "learning_note": "Agent B response in Bangla..."
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [TASK]: Start the conversation with high energy.
            [JSON]: {"conversation": "Hello! I am ready...", "learning_note": "আসসালামু আলাইকুম! আমি রেডি।"}
            `;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [USER SAID]: "${message}"
            [TASK]: Agent A replies naturally. Agent B analyzes & teaches.
            [JSON]: {"conversation": "...", "learning_note": "..."}
            `;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        // 🛡️ ROBUST PARSING LOGIC
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            } else {
                // If AI returns plain text, use it safely
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

        // Final Safety Check
        if (!parsedData.conversation || parsedData.conversation.length < 2) parsedData.conversation = "I am listening. Go on.";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("CRITICAL SERVER ERROR:", err.message);
        res.json({ 
            reply: "System is upgrading. Please say that again.", 
            instruction: "সার্ভার আপডেট হচ্ছে। দয়া করে আবার বলুন।" 
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
        
        // 🔥 MODEL: Mixtral-8x7b (Smart & Stable)
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "mixtral-8x7b-32768", 
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
