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

// 🛡️ UTILS
const safeString = (val) => {
    if (val === null || val === undefined) return "";
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

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A' };
    
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS (LEVEL CALCULATION ADDED)
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A' };
        saveDB(db);
    }
    
    const score = db[userId].lifetime_score || 0;
    // 🎚️ LEVEL CALCULATION: Initial Level 1, +1 for every 1000 points
    const level = Math.floor(score / 1000) + 1;

    res.json({ 
        total: db[userId].total_msgs, 
        score: score,
        level: level,
        lifetime_seconds: db[userId].total_time || 0 
    });
});

// 💬 API: CHAT (SCENARIO ARCHITECT ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    
    message = sanitizeInput(message);
    // Extract Skill Level from systemInstruction string (e.g. "Skill Level: B...")
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill };
    
    // Save latest skill
    db[userId].current_skill = userSkill;
    
    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    saveDB(db);

    // Get current progress
    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;
    const experience = currentScore % 1000; // Progress within current level

    try {
        let finalPrompt = "";

        // 🧠 SUPER PROMPT: SCENARIO ARCHITECT + ISLAMIC MENTOR
        const guardRails = `
        [SYSTEM IDENTITY]
        You are a Dual-Agent Spoken English Training System.
        
        [USER PROFILE GUESS]
        - Skill Level Input: ${userSkill} (A=Newbie, E=Pro)
        - Current Level: ${currentLevel}
        - Lifetime Score: ${currentScore}
        - Inferred Psychology: ${currentScore < 50 ? "Nervous, needs validation" : "Confident, needs challenges"}.
        
        [AGENT A: SCENARIO ARCHITECT (The "Chat Bubble")]
        - Role: You DO NOT just chat. You set a SCENE and give a TASK.
        - Language: ENGLISH ONLY.
        - Logic: 
          1. Create a real-life scenario based on User's Skill & Level (Level 1 = Buying Pen, Level 5 = Business Deal).
          2. Ask the user to Perform a specific Speech Act (e.g., "Ask for the price", "Greet the boss").
          3. **CRITICAL LOOP:** - If User's last reply was WRONG: Repeat the SAME task again.
             - If User's last reply was CORRECT: Move to the NEXT step of the scenario.
        
        [AGENT B: MENTOR (The "Yellow Box")]
        - Persona: Skilled Professional & Practicing Muslim. High Islamic Standards.
        - Language: BANGLA SCRIPT (বাংলা).
        - **TASK:** Judge the user's latest input.
        - **SCORING RULE:**
          - Correct/Passable English? -> Score +10. Message: "মাশাআল্লাহ! [Feedback]. Now try the next step."
          - Grammar/Context Error? -> Score 0. Message: "চেষ্টা ভালো ছিল, কিন্তু একটু ভুল হয়েছে। [Correction]. ইনশাআল্লাহ আরেকবার ট্রাই করুন।"
        - Behavior: Keep user busy. Never deviate from the lesson. If user talks rubbish, bring them back to the task.

        [OUTPUT FORMAT - JSON ONLY]:
        {
            "conversation": "English Instruction/Scenario Step...",
            "learning_note": "Bangla Feedback & Correction...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${guardRails} 
            [SITUATION]: New Session Start.
            [TASK]: 
            1. Analyze Skill Level ${userSkill}.
            2. Create a 10-step Scenario appropriate for Level ${currentLevel}.
            3. Present **STEP 1** in "conversation".
            4. In "learning_note", say "আসসালামু আলাইকুম! আজকের সেশন শুরু করছি। ইনশাআল্লাহ আপনি পারবেন।"
            [JSON REQUIRED]`;
        } else {
            finalPrompt = `
            ${guardRails} 
            [USER INPUT]: "${message}"
            [TASK]: 
            1. Analyze user's English.
            2. If CORRECT: Give +10 points. In "conversation", advance to the Next Logical Step of the scenario.
            3. If WRONG: Give 0 points. In "conversation", REPEAT the previous instruction/task so they try again.
            4. In "learning_note": Explain mistake or give 'MashAllah' and hints for the next step.
            [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start Simulation" : message }];
        
        // AI Call
        const rawResponse = await callGroq(messages, 0.5); // Lower temp for strict logic
        
        // Response Parsing
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 0 };
        } 
        catch (e) {
            parsedData = { conversation: "Please try again.", learning_note: "নেটওয়ার্ক সমস্যা।", score_added: 0 }; 
        }

        // 🛡️ Fail-safe
        if (!parsedData.conversation) parsedData.conversation = "Let's continue. What would you say next?";
        if (!parsedData.learning_note) parsedData.learning_note = "চালিয়ে যান।";

        // 🛑 UPDATE SCORE IN DB
        if (!isStart && parsedData.score_added > 0) {
            db[userId].lifetime_score = (db[userId].lifetime_score || 0) + 10;
            saveDB(db);
        }

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note),
            score_added: parsedData.score_added || 0, // Send to frontend for Popup
            new_total_score: db[userId].lifetime_score
        });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.json({ reply: "Connection stabilized. Say again.", instruction: "কানেকশন ঠিক হয়েছে। আবার বলুন।" });
    }
});

// 👑 ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.lifetime_score || 0) - (a.lifetime_score || 0));
    
    let html = `
    <html>
    <head><title>Admin Stats</title><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#58cc02;color:white}</style></head>
    <body>
        <h1>User Statistics</h1>
        <table>
            <tr><th>User ID</th><th>Level</th><th>Score</th><th>Messages</th><th>Time (Mins)</th></tr>
    `;
    
    users.forEach(u => {
        const lvl = Math.floor((u.lifetime_score||0)/1000) + 1;
        html += `<tr>
            <td>${u.id}</td>
            <td>${lvl} (${u.current_skill || 'N/A'})</td>
            <td>${u.lifetime_score || 0}</td>
            <td>${u.total_msgs}</td>
            <td>${Math.floor((u.total_time || 0) / 60)}</td>
        </tr>`;
    });
    
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
