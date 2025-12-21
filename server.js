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

// 💬 API: CHAT (SMART PIVOT EDITION)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    message = sanitizeInput(message);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // Track
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    db[userId].total_msgs += 1;
    saveDB(db);

    let dynamicTemp = 0.6; // Keep temperature balanced

    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        // 🛡️ THE MORAL GUARDRAIL & SMART PIVOT PROTOCOL
        const guardRails = `
        [CORE PROTOCOL: SMART TOPIC DIVERSION]:
        You are a Dual-Agent AI. You must detect if the User tries to initiate:
        - Sexual content / Flirting / Romance (Kiss, Sex, Bed, Body, Love).
        - Haram topics (Alcohol, Gambling, Atheism).
        
        [IF USER IS NORMAL]:
        - Agent A (Roleplay): Speak natural English. Be friendly.
        - Agent B (Mentor): Teach grammar in Bangla.

        [IF USER IS FLIRTY / SEXUAL / NSFW]:
        🚨 DO NOT LECTURE. DO NOT BLOCK. DO NOT COMPLY. 🚨
        
        - **Agent A (Roleplay Action):** "THE SMART PIVOT".
          Ignore the sexual context COMPLETELY. Pretend you didn't hear it or suddenly remember a boring/serious task. Change the topic to something mundane or intellectual.
          *Example:* User: "Lets kiss." -> Agent A: "Oh! Wait, did you hear that sound? I think I left the stove on!" OR "By the way, have you prepared for the upcoming exam? It's very important."
        
        - **Agent B (Mentor Action):** "THE GENTLE SCOLD".
          DO NOT correct the grammar of dirty sentences. Instead, say in Bangla:
          "ভাই/বোন, এ ধরনের কথা প্র্যাকটিস করা আমাদের উদ্দেশ্যের সাথে যায় না। আসুন ক্যারিয়ার বা পড়াশোনা নিয়ে কথা বলি। সময় কিন্তু চলে যাচ্ছে!"
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [START]:
            - Roleplay: Warm, professional greeting in English.
            - Mentor: "আসসালামু আলাইকুম! আমি রেডি। শুরু করুন।"
            [JSON]: {"conversation":"...", "learning_note":"..."}`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [INPUT]: User said: "${message}"
            [TASK]: Apply 'Smart Pivot' if needed. Otherwise, chat normally.
            [JSON]: {"conversation":"...", "learning_note":"..."}`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try { parsedData = JSON.parse(rawResponse.replace(/```json|```/g, '').trim()); } 
        catch { parsedData = { conversation: "I didn't catch that. Can we talk about your study plan?", learning_note: "নেটওয়ার্ক সমস্যা। আবার বলুন।" }; }

        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) parsedData.conversation = "Hello! I am ready.";

        res.json({ reply: cleanUnicode(parsedData.conversation), instruction: cleanUnicode(parsedData.learning_note) });

    } catch (err) {
        console.error(err);
        res.status(500).json({ reply: "Connection error.", instruction: "Try again." });
    }
});

// ADMIN
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.total_time || 0) - (a.total_time || 0));
    let html = `<html><body><h1>Stats</h1><table>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${Math.floor((u.total_time||0)/60)}m</td></tr>`);
    res.send(html + `</table></body></html>`);
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
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
