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

// 📂 SIMPLE DATABASE FILE
const DB_FILE = path.join(__dirname, 'user_db.json');

// 🛠️ DATABASE ENGINE (Load/Save)
const loadDB = () => {
    if (!fs.existsSync(DB_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { return {}; }
};

const saveDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// 🔧 UTILS
const cleanUnicode = (str) => {
    if (!str) return "";
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

// 📊 API: GET USER STATS (Called on App Start)
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    
    if (!db[userId]) {
        // New User
        db[userId] = { 
            total_msgs: 0, 
            first_seen: new Date().toISOString(), 
            last_active: new Date().toISOString(),
            active_days: 1 
        };
        saveDB(db);
    }

    const userData = db[userId];
    
    // Calculate Average
    const firstDate = new Date(userData.first_seen);
    const today = new Date();
    const diffTime = Math.abs(today - firstDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; 
    const avg = (userData.total_msgs / diffDays).toFixed(1);

    res.json({ 
        total: userData.total_msgs, 
        avg: avg,
        days: diffDays
    });
});

// 💬 API: CHAT (With Tracking Logic)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';
    userId = sanitizeInput(userId) || 'anonymous';

    // 📈 TRACKING LOGIC
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, first_seen: new Date().toISOString(), active_days: 1 };
    }
    
    // Update Stats
    db[userId].total_msgs += 1;
    db[userId].last_active = new Date().toISOString();
    saveDB(db); // Save to file

    // 🌡️ AI LOGIC REMAINS SAME
    let dynamicTemp = 0.5;
    const lowerMood = mood.toLowerCase();
    if (lowerMood.includes('fun')) dynamicTemp = 0.8;
    else if (lowerMood.includes('serious')) dynamicTemp = 0.3;

    const isStart = message === "Action!";

    try {
        const mentorCoreIdentity = `
        [IDENTITY]: You are 'Talk24AI Mentor'.
        [CORE PHILOSOPHY]: Internal software coded with Islamic Scholars' ideology (Time is Life, Truth is Absolute).
        [PERSONA]: Outwardly 'S@ifur Sir', Inwardly a Wise Murubbi.
        `;

        const mentorBehaviorRule = `
        1. SITUATION: Normal chat -> Act as 'S@ifur Sir'. Practical, Short.
        2. SITUATION: Lazy/Wasting time -> Activate 'Scholar Ideology'. Scold gently ("Time is Life").
        3. SITUATION: Atheism/Music/Fahisha -> Activate 'Ideological Core'. Correct logic in BANGLA.
        `;

        let finalPrompt = "";

        if (isStart) {
            finalPrompt = `
            ${systemInstruction}
            [INSTRUCTION]: START.
            1. Roleplay AI: Opening line.
            2. Mentor: "আসসালামু আলাইকুম! সময় হলো জীবন। চলো শুরু করি।"
            [OUTPUT]: JSON Only.`;
        } else {
            finalPrompt = `
            ${systemInstruction}
            ${mentorCoreIdentity}
            ${mentorBehaviorRule}
            [TASK]: Check user's message. Write 'learning_note' in BANGLA.
            [OUTPUT]: JSON Only. { "conversation": "...", "learning_note": "..." }`;
        }

        const messages = [
            { role: "system", content: finalPrompt },
            { role: "user", content: isStart ? "Start roleplay" : message }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "নেটওয়ার্ক সমস্যার কারণে নোট লোড হয়নি।" 
            };
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

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile",
            max_tokens: 800,
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Tracking Server running on http://localhost:${PORT}`));
