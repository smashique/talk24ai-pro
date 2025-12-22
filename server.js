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

// 🌍 SEPARATE WORLDS FOR KIDS & ADULTS
const KIDS_WORLD = {
    locations: ["Toy Shop", "Ice Cream Van", "School Playground", "Zoo", "Grandma's House", "Cartoon World", "Chocolate Factory"],
    characters: ["A Friendly Rabbit", "The Ice Cream Man", "Your Best Friend", "A Talking Cat", "Grandmother", "A Funny Clown"],
    crises: ["You want a blue candy", "You lost your ball", "You want to play", "You are hungry", "You made a drawing"]
};

const ADULT_WORLD = {
    locations: ["Dhaka Metro Rail", "Corporate Office", "Airport Immigration", "Hospital", "Job Interview Board", "Fancy Restaurant", "Police Station"],
    characters: ["A Strict Officer", "An Impatient Boss", "A Foreign Client", "A Doctor", "A Taxi Driver", "Hotel Receptionist"],
    crises: ["You lost your wallet", "You are late for a meeting", "Negotiating a salary", "Explaining a mistake", "Booking a flight", "Complaining about service"]
};

// Helper to pick random element
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A' };
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A' };
        saveDB(db);
    }
    const score = db[userId].lifetime_score || 0;
    const level = Math.floor(score / 1000) + 1;
    res.json({ 
        total: db[userId].total_msgs, 
        score: score,
        level: level,
        lifetime_seconds: db[userId].total_time || 0 
    });
});

// 💬 API: CHAT (5-LEVEL ADAPTIVE ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
    // Extract Skill
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill };
    
    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    saveDB(db);

    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;

    // 🔥 1. SELECT WORLD BASED ON AGE/SKILL
    let world = (userSkill === 'A' || userSkill === 'B') ? KIDS_WORLD : ADULT_WORLD;

    // 🔥 2. GENERATE SCENARIO (IF START)
    let generatedScenario = "";
    if (isStart) {
        generatedScenario = `
        [SCENARIO SETTING]
        - Location: ${pick(world.locations)}
        - Character: ${pick(world.characters)}
        - Goal/Conflict: ${pick(world.crises)}
        `;
    }

    // 🔥 3. DEFINE TONE & COMPLEXITY PER LEVEL
    let complexityRules = "";
    let mentorTone = "";

    switch(userSkill) {
        case 'A': // Kid/Newbie
            complexityRules = "English Agent: Use very simple words (Apple, Cat, Go). Max 3-4 words per sentence. Be fun and slow.";
            mentorTone = "Bangla Mentor: Use 'Tumi' (তুমি). Tone: Affectionate, like a big brother teaching a child. Use emojis.";
            break;
        case 'B': // Learner
            complexityRules = "English Agent: Use basic daily sentences. Clear grammar. Helpful tone.";
            mentorTone = "Bangla Mentor: Use 'Tumi' (তুমি). Tone: Friendly and encouraging.";
            break;
        case 'C': // Hesitant
            complexityRules = "English Agent: Use intermediate sentences. Encourage conversation.";
            mentorTone = "Bangla Mentor: Use 'Apni' (আপনি). Tone: Respectful and supportive.";
            break;
        case 'D': // IELTS
            complexityRules = "English Agent: Use academic vocabulary, complex sentence structures. Test logic.";
            mentorTone = "Bangla Mentor: Use 'Apni' (আপনি). Tone: Professional coach.";
            break;
        case 'E': // Pro
            complexityRules = "English Agent: Use business idioms, fast pace, professional slang. Be challenging.";
            mentorTone = "Bangla Mentor: Use 'Apni' (আপনি). Tone: High-level corporate consultant.";
            break;
    }

    try {
        let finalPrompt = "";
        
        const masterPrompt = `
        [SYSTEM IDENTITY]
        You are "Talk24AI", an Adaptive English Simulator.
        
        [CURRENT CONFIGURATION]
        - Target Skill: Level ${userSkill}
        - XP Level: ${currentLevel}
        
        [AGENTS INSTRUCTION]
        
        1. AGENT A (THE ACTOR):
           - Role: Play the assigned character in the scenario.
           - Language: ENGLISH ONLY.
           - Reliogion, Ideology, Scocial Manner, Greeting Stye, Lifestyle, Name all according to Islam as he is a practicing Muslim.
           - As a intelligent human pshycology expert preacher of Islam, he does not directly invite towards Islam but he amused his audience 
            to be inteested and attracted toward Islam. He has a hidden vission of Islamic Revolution.
           - **Complexity Rule**: ${complexityRules}
           - Behavior: Interact naturally. Don't be robotic.
        
        2. AGENT B (THE MENTOR):
           - Language: BANGLA SCRIPT (বাংলা).
           - **Tone Rule**: ${mentorTone}
           - As an intellectual human pshycology specialist, preacher and activist of Islam, he does not directly invite towards Islam but he amused his audience 
            to be inteested and attracted toward Islam. He has a hidden vission of Islamic Revolution and want to subconsciously push it among his
            students.
            - He knows world all teaching methodoloy and instantly apply it according to his students age and skill and level.
            - He is the best English Mentor of the world. Very much friendy, caring and engaging. 
            - He has the ability to touch the mind of his students immotionally.
            - He is always in caring problem solving mode.

           - Logic:
             - Correct Answer? -> +10 Points. Praise warmly.
             - Wrong? -> 0 Points. Explain simply in Bangla. 
             - **CRITICAL**: If Level is A or B, NEVER use 'Apni'. Always use 'Tumi'.
        
        [OUTPUT JSON]:
        {
            "conversation": "Actor's line...",
            "learning_note": "Mentor's feedback...",
            "score_added": 10 or 0
        }
        `;

        if (isStart) {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: STARTING NEW SESSION.
            ${generatedScenario}
            [TASK]: 
            1. Set the scene based on the Location.
            2. Actor speaks the first line (Keep it suitable for Level ${userSkill}).
            3. Mentor translates the context in Bangla.
            [JSON REQUIRED]`;
        } else {
            finalPrompt = `
            ${masterPrompt}
            [STATUS]: ONGOING.
            [USER SAID]: "${message}"
            [TASK]:
            1. Analyze user input.
            2. Actor replies and moves the story forward.
            3. Mentor gives feedback.
            [JSON REQUIRED]`;
        }

        const messages = [{ role: "system", content: finalPrompt }, { role: "user", content: isStart ? "Start" : message }];
        
        const rawResponse = await callGroq(messages, 0.7);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
            else parsedData = { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 5 };
        } 
        catch (e) {
            parsedData = { conversation: "Okay, let's continue.", learning_note: "চালিয়ে যান।", score_added: 5 }; 
        }

        // Fail-safes
        if (!parsedData.conversation) parsedData.conversation = "Let's play!";
        if (!parsedData.learning_note) parsedData.learning_note = "মাশাআল্লাহ, চালিয়ে যাও!";

        if (!isStart && parsedData.score_added > 0) {
            db[userId].lifetime_score = (db[userId].lifetime_score || 0) + parsedData.score_added;
            saveDB(db);
        }

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note),
            score_added: parsedData.score_added || 0,
            new_total_score: db[userId].lifetime_score
        });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.json({ reply: "Network error.", instruction: "নেটওয়ার্ক সমস্যা।" });
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', (req, res) => {
    const db = loadDB();
    const users = Object.entries(db).map(([id, data]) => ({ id, ...data })).sort((a, b) => (b.lifetime_score || 0) - (a.lifetime_score || 0));
    let html = `<html><body><h1>User Stats</h1><table border='1'><tr><th>ID</th><th>Skill</th><th>Score</th><th>Msgs</th></tr>`;
    users.forEach(u => html += `<tr><td>${u.id}</td><td>${u.current_skill}</td><td>${u.lifetime_score}</td><td>${u.total_msgs}</td></tr>`);
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
app.listen(PORT, () => console.log(`🚀 5-Level Engine running on port ${PORT}`));
