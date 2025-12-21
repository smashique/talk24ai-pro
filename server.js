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
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

// 📊 API: GET USER STATS (For App Display)
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
    res.json({ total: userData.total_msgs });
});

// 💬 API: CHAT (With Tracking & Strict Logic)
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
    db[userId].total_msgs += 1;
    db[userId].last_active = new Date().toISOString();
    saveDB(db);

    // 🌡️ MOOD LOGIC
    let dynamicTemp = 0.5; 
    if (mood.toLowerCase().includes('fun')) dynamicTemp = 0.8;

    const isStart = message === "Action!";

    try {
        let finalPrompt = "";

        if (isStart) {
            // 🚀 FORCE START PROMPT
            finalPrompt = `
            ${systemInstruction}
            [CRITICAL TASK]: You MUST speak first.
            [AGENT A - ROLEPLAY]: Generate natural English opening line.
            [AGENT B - MENTOR]: Output EXACTLY: "আসসালামু আলাইকুম! সময় হলো জীবন। তাই এক মুহূর্তও নষ্ট না করে চলো প্র্যাকটিস শুরু করি। ভয় পাবে না, আমি আছি।"
            [OUTPUT JSON]: { "conversation": "...", "learning_note": "..." }`;
        } else {
            // 🔄 CONTINUOUS CHAT PROMPT
            finalPrompt = `
            ${systemInstruction}
            [AGENT A - ROLEPLAY]:
            - Act as the character. English ONLY.
            - If sensitive topic (Atheism/Music/Fahisha) -> Polite dodge in English.
            [AGENT B - MENTOR (Saifur Sir + Scholar)]:
            - Bangla ONLY.
            - Analyze user's English. Correct errors.
            - If lazy -> Scold gently ("Time is Life").
            [OUTPUT JSON]: { "conversation": "...", "learning_note": "..." }`;
        }

        const messages = [
            { role: "system", content: finalPrompt },
            { role: "user", content: isStart ? "Start now." : message }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            parsedData = { 
                conversation: "Hello! I am ready to start.", 
                learning_note: "যান্ত্রিক ত্রুটির কারণে নোট লোড হয়নি।" 
            };
        }

        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) {
            parsedData.conversation = "Hello! I am ready. Shall we start?";
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

// 👑 ADMIN DASHBOARD ROUTE (Secret Link)
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    // Sort by Messages (High to Low)
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total_msgs - a.total_msgs);

    let html = `
    <html>
    <head>
        <title>Talk24AI Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: sans-serif; padding: 20px; background: #f4f4f9; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
            th { background: #58cc02; color: white; }
            tr:nth-child(even) { background: #f9f9f9; }
            .badge { background: #1cb0f6; color: white; padding: 4px 8px; border-radius: 10px; font-weight:bold; }
        </style>
    </head>
    <body>
        <h1>👑 Admin Dashboard</h1>
        <p>Total Users: <strong>${users.length}</strong></p>
        <table>
            <thead>
                <tr>
                    <th>User ID</th>
                    <th>Msgs</th>
                    <th>Last Active</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(u => {
        html += `
            <tr>
                <td><b>${u.id}</b></td>
                <td><span class="badge">${u.total_msgs}</span></td>
                <td>${new Date(u.last_active).toLocaleString()}</td>
            </tr>
        `;
    });

    html += `</tbody></table></body></html>`;
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
