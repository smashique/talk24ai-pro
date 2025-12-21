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
    return s.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
};

const sanitizeInput = (text) => {
    const s = safeString(text);
    return s.replace(/<[^>]*>?/gm, '').trim();
};

// ⏱️ API: UPDATE TIME (NO CHANGE)
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_mistakes: 0, total_time: 0 };
    
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS (CALCULATE ACCURACY)
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, total_mistakes: 0, total_time: 0 };
        saveDB(db);
    }
    
    const total = db[userId].total_msgs || 0;
    const mistakes = db[userId].total_mistakes || 0;
    // যদি একদম নতুন হয় (0 msg), তবে 100% দেখাবে উৎসাহ দিতে
    const accuracy = total === 0 ? 100 : Math.round(((total - mistakes) / total) * 100);

    res.json({ 
        total: total, 
        accuracy: accuracy,
        lifetime_seconds: db[userId].total_time || 0 
    });
});

// 💬 API: CHAT (WITH JUDGE LOGIC)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    
    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_mistakes: 0, total_time: 0 };
    
    // মেসেজ কাউন্ট বাড়াও (শুরুর মেসেজ বাদে)
    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    
    saveDB(db);

    let dynamicTemp = 0.6; 

    try {
        let finalPrompt = "";

        // 🧠 PROMPT: AGENT A (Actor) + AGENT B (Mentor) + JUDGE (Mistake Counter)
        const guardRails = `
        [SYSTEM PROTOCOL]
        
        [AGENT A: ACTOR]
        - Speak ENGLISH ONLY.
        - Be friendly and natural.
        - a master role-player who embodies Islamic Excellence across Belief, Manner and social dealings, using impeccable
          character to silently invite hearts towards Islam
        - Pivot from NSFW topics.

        [AGENT B: MENTOR & JUDGE]
        - Speak BANGLA SCRIPT.
        - Role: Skilled Professional & Practicing Muslim Mentor.
        - **JUDGMENT TASK:** Did the user make a grammar/vocab mistake? 
          - Set "has_mistake": true (if error found)
          - Set "has_mistake": false (if correct)
        - **Structure:** 1. Review, 2. Correction, 3. Next Step.
        
        [JSON OUTPUT ONLY]:
        {
            "conversation": "English reply...",
            "learning_note": "Bangla feedback...",
            "has_mistake": true/false
        }
        `;

        if (isStart) {
            finalPrompt = `${systemInstruction} ${guardRails} [TASK]: Start warmly. [JSON REQUIRED]`;
        } else {
            finalPrompt = `${systemInstruction} ${guardRails} [USER]: "${message}" [TASK]: Reply, Teach & Judge. [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        // Call AI (Llama 3.1 8b Instant)
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        // Parsing
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান。", has_mistake: false };
        } 
        catch (e) {
            parsedData = { conversation: safeString(rawResponse).replace(/["{}]/g, ''), learning_note: "চালিয়ে যান।", has_mistake: false }; 
        }

        if (!parsedData.conversation) parsedData.conversation = "I am listening...";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        // 🛑 UPDATE MISTAKE COUNT IN DB
        if (!isStart && parsedData.has_mistake === true) {
            db[userId].total_mistakes += 1;
            saveDB(db);
        }

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note) 
        });

    } catch (err) {
        console.error("Error:", err.message);
        res.json({ reply: "Connection stabilized. Say again.", instruction: "কানেকশন ঠিক হয়েছে। আবার বলুন।" });
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.total_time || 0) - (a.total_time || 0));
    let html = `<html><body><h1>User Stats</h1><table border='1'><tr><th>ID</th><th>Msgs</th><th>Mistakes</th><th>Time</th></tr>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${u.total_msgs}</td><td>${u.total_mistakes||0}</td><td>${Math.floor((u.total_time||0)/60)}m</td></tr>`);
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
