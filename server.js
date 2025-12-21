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

// 🔧 UTILS (Safety First)
const safeString = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') return val;
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

// 💬 API: CHAT (SMART MENTOR LOGIC)
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

    let dynamicTemp = 0.6; 
    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        // 🧠 SUPER PROMPT: MENTOR STRATEGY
        const guardRails = `
        [SYSTEM PROTOCOL]: Dual-Agent Language Learning System.
        
        [AGENT A - ROLEPLAY ACTOR (English Only)]:
        - Act naturally based on the role (Teacher, Shopkeeper, etc.).
        - Always end with a relevant question to keep the chat going.
        - **SAFETY:** If user is Flirty/Abusive -> Pivot immediately to a boring topic (Weather/Study). Ignore the bad behavior.

        [AGENT B - MENTOR (Bangla Only)]:
        - **Language:** STRICTLY BENGALI SCRIPT.
        - **Tone:** Supportive, Wise, Teacher-like.
        - **MANDATORY CONTENT STRUCTURE:**
          1. **Review (পর্যালোচনা):** Check the User's last message ("${message}"). Correct any grammar/vocab errors politely. If correct, praise them.
          2. **New Lesson (নতুন শিক্ষা):** Teach ONE new word, idiom, or grammar rule relevant to the current conversation context.
          3. **Next Instruction (পরবর্তী নির্দেশনা):** Give a HINT or STRATEGY on how to answer Agent A's current question.
             - ❌ DO NOT write the answer for them.
             - ✅ DO SAY: "এখন আপনি Present Perfect Tense ব্যবহার করে বলুন...", "ভদ্রভাবে অনুরোধ করতে 'Could you' দিয়ে বাক্য শুরু করুন..."
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [START SCENARIO]:
            - Roleplay: High energy greeting + Question.
            - Mentor: "আসসালামু আলাইকুম! আমি তৈরি। বিসমিল্লাহ বলে শুরু করুন।"
            [REQUIRED JSON]: {"conversation":"...", "learning_note":"..."}`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [USER INPUT]: "${message}"
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
                parsedData = { 
                    conversation: safeString(rawResponse).replace(/"/g, ''), 
                    learning_note: "চালিয়ে যান। (নেটওয়ার্ক সমস্যার কারণে নোট লোড হয়নি)" 
                }; 
            }
        }

        if (!parsedData.conversation) parsedData.conversation = "I am listening.";
        if (!parsedData.learning_note) parsedData.learning_note = "চমৎকার! চালিয়ে যান।";

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("CRITICAL ERROR HANDLED:", err.message);
        res.json({ 
            reply: "I need a moment to think. Please say that again?", 
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
        
        // 🚀 FASTEST MODEL
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
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
