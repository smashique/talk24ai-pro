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

// 💬 API: CHAT (SAFETY & MODERATION EDITION)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;
    message = sanitizeInput(message);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // Track Usage
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, total_time: 0, first_seen: new Date().toISOString() };
    db[userId].total_msgs += 1;
    saveDB(db);

    let dynamicTemp = 0.6; 

    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        // 🛡️ CONTENT MODERATION & SAFETY PROTOCOL
        const guardRails = `
        [SYSTEM PROTOCOL: CONTENT SAFETY & MODERATION]:
        You are a Dual-Agent AI acting as a language learning partner. You must detect if the User's input contains:
        - Explicit sexual content, flirting, or romantic advances.
        - Harmful, illegal, or offensive topics.
        
        [IF USER INPUT IS APPROPRIATE]:
        - Agent A (Roleplay): Reply naturally in English based on the role. Be friendly and engaging.
        - Agent B (Mentor): Provide feedback on the user's English in Bangla.

        [IF USER INPUT IS INAPPROPRIATE / SEXUAL / NSFW]:
        🚨 ACTION REQUIRED: DIVERT AND REFOCUS 🚨
        
        - **Agent A (Roleplay Action):** "THE PIVOT".
          Do NOT engage with the explicit content. Do NOT roleplay sexual scenarios.
          Instead, immediately change the subject to a safe, neutral, or professional topic related to general conversation or the previous context (if safe).
          *Example:* If user says something inappropriate, Agent A might say: "I think we are getting off track. Let's talk about your travel plans instead. Where do you want to go?" or "Oh, I just remembered, have you prepared for the interview?"
        
        - **Agent B (Mentor Action):** "THE PROFESSIONAL REMINDER".
          Do NOT correct the grammar of the inappropriate text.
          Instead, output a standard message in Bangla reminding the user of the learning goal:
          "অনুগ্রহ করে মনে রাখবেন, এটি একটি ইংরেজি শেখার প্ল্যাটফর্ম। আসুন আমরা প্রাসঙ্গিক এবং পেশাদার আলোচনায় ফিরে যাই।" (Please remember this is an English learning platform. Let's return to relevant and professional discussion.)
        `;

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [START]:
            - Roleplay: Warm, professional greeting in English based on the scene.
            - Mentor: "আসসালামু আলাইকুম! আমি রেডি। শুরু করুন।"
            [JSON OUTPUT ONLY]: {"conversation":"...", "learning_note":"..."}`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${guardRails}
            [INPUT]: User said: "${message}"
            [TASK]: Evaluate input for safety. If safe, reply and teach. If unsafe, pivot and remind.
            [JSON OUTPUT ONLY]: {"conversation":"...", "learning_note":"..."}`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try { 
            // Attempt to parse JSON response
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found");
            }
        } 
        catch (e) { 
            console.error("Parsing Error:", e.message, rawResponse);
            parsedData = { 
                conversation: "I'm sorry, I didn't catch that. Could we try again?", 
                learning_note: "যান্ত্রিক ত্রুটির কারণে নোট লোড হয়নি। আবার চেষ্টা করুন।" 
            }; 
        }

        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) parsedData.conversation = "Hello! I am ready to practice English.";

        res.json({ reply: cleanUnicode(parsedData.conversation), instruction: cleanUnicode(parsedData.learning_note) });

    } catch (err) {
        console.error("API Error:", err.message);
        res.status(500).json({ reply: "Connection error.", instruction: "Try again." });
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.total_time || 0) - (a.total_time || 0));
    let html = `<html><body><h1>Stats</h1><table>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${Math.floor((u.total_time||0)/60)}m</td></tr>`);
    res.send(html + `</table></body></html>`);
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
        throw new Error("AI Failed: " + err.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
