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
const safeString = (val) => (val === null || val === undefined) ? "" : String(val);

const cleanUnicode = (str) => {
    const s = safeString(str); 
    return s.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
};

const sanitizeInput = (text) => {
    const s = safeString(text);
    return s.replace(/<[^>]*>?/gm, '').trim();
};

// 🌍 SEPARATE WORLDS
const KIDS_WORLD = {
    locations: ["Toy Shop", "Ice Cream Van", "School Playground", "Zoo", "Grandma's House", "Cartoon World"],
    characters: ["A Friendly Rabbit", "The Ice Cream Man", "Your Best Friend", "Grandmother", "A Funny Clown"],
    crises: ["You want a blue candy", "You lost your ball", "You want to play", "You are hungry", "Show your drawing"]
};

const ADULT_WORLD = {
    locations: ["Corporate Office", "Airport Immigration", "Hospital", "Job Interview", "Restaurant", "Police Station"],
    characters: ["Strict Officer", "Impatient Boss", "Foreign Client", "Doctor", "Manager"],
    crises: ["Lost wallet", "Late for meeting", "Negotiating salary", "Explaining mistake", "Booking flight"]
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ⏱️ API: UPDATE TIME
app.post('/api/update-time', (req, res) => {
    const { userId, seconds } = req.body;
    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A', history: [] };
    db[userId].total_time = (db[userId].total_time || 0) + seconds;
    saveDB(db);
    res.json({ success: true });
});

// 📊 API: STATS
app.post('/api/stats', (req, res) => {
    const { userId } = req.body;
    const db = loadDB();
    if (!db[userId]) {
        db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: 'A', history: [] };
        saveDB(db);
    }
    const score = db[userId].lifetime_score || 0;
    const level = Math.floor(score / 1000) + 1;
    res.json({ total: db[userId].total_msgs, score, level, lifetime_seconds: db[userId].total_time || 0 });
});

// 💬 API: CHAT (ISLAMIC MASTERY ENGINE)
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId } = req.body;
    message = sanitizeInput(message);
    
    const skillMatch = systemInstruction.match(/Skill Level: ([A-E])/);
    const userSkill = skillMatch ? skillMatch[1] : 'A';
    userId = sanitizeInput(userId) || 'anonymous';

    const db = loadDB();
    if (!db[userId]) db[userId] = { total_msgs: 0, lifetime_score: 0, total_time: 0, current_skill: userSkill, history: [] };
    if (!Array.isArray(db[userId].history)) db[userId].history = [];

    const isStart = message === "Action!";
    if (!isStart) db[userId].total_msgs += 1;
    if (isStart) db[userId].history = []; 

    const currentScore = db[userId].lifetime_score || 0;
    const currentLevel = Math.floor(currentScore / 1000) + 1;

    let world = (userSkill === 'A' || userSkill === 'B') ? KIDS_WORLD : ADULT_WORLD;

    let generatedScenario = "";
    if (isStart) {
        generatedScenario = `PLACE: ${pick(world.locations)}, CHARACTER: ${pick(world.characters)}, GOAL: ${pick(world.crises)}`;
    }

    // --- EXPERT METHODOLOGY ASSIGNMENT ---
    let complexityRules = "";
    let mentorTone = "";
    if (['A', 'B'].includes(userSkill)) {
        complexityRules = "Method: Montessori/TPR. Simple vocabulary, max 4 words. Playful.";
        mentorTone = "Tone: Affectionate Big Brother (Tumi/তুমি). Focus on 'Play-Based Learning'.";
    } else if (userSkill === 'C') {
        complexityRules = "Method: Psychological Safety. Intermediate English.";
        mentorTone = "Tone: Supportive Guide (Apni/আপনি). Focus on overcoming fear.";
    } else {
        complexityRules = "Method: Academic/Task-Based. Formal, complex structures.";
        mentorTone = "Tone: Strict Professional Coach (Apni/আপনি). Focus on precision and logic.";
    }

    const contextLog = db[userId].history.slice(-6).map(h => `${h.role === 'Actor' ? 'Actor' : 'User'}: "${h.content}"`).join("\n");

    try {
        // 🧠 WORLD-CLASS ISLAMIC MASTERY PROMPT
        const masterPrompt = `
        [MASTER PERSONA]
        You are a world-class expert in English Language Training and Educational Psychology. 
        You are also a practicing Muslim. Your mission is to teach English while subconsciously preaching 
        Islamic values (Dawah) through your tone, examples, and wisdom.
        Think step by step and analyze the following request deeply.

        [KEY LOGIC POINTS TO FOLLOW]
        1. Contextual Integrity: Ensure Actor stays in role and reacts logically to history.
        2. Subconscious Dawah: Use Islamic etiquette (Greetings, Alhamdulillah, InshaAllah) and weave moral lessons into your feedback.
        3. Relevance Enforcement: Mentor must penalize (Score 0) any irrelevant/out-of-topic replies.
        4. Linguistic Precision: Mentor must use Standard Bangla (প্রমিত বাংলা) with zero dialect noise.
        5. Level-Specific Tone: Strictly use 'তুমি' for A/B (Kids) and 'আপনি' for C/D/E (Adults).

        [CURRENT SETTINGS]
        - Level: ${userSkill} | XP: ${currentLevel}
        - Current Scenario: ${generatedScenario || "Continuing context"}
        - History: ${contextLog || "New Session."}

        [AGENT A: THE ACTOR (English Only)]
        - Rule: ${complexityRules}
        - Personality: A kind and honest character. Use Islamic greetings (Assalamu alaikum) naturally. Show gratitude.

        [AGENT B: THE MENTOR (Bangla Only)]
        - Rule: ${mentorTone}
        - Task: Judge input strictly but with an Islamic caring heart.
          - Give +10 score ONLY if (Reply is Relevant AND Grammar is functional).
          - FEEDBACK: Start with words like "মাশাআল্লাহ" or "আলহামদুলিল্লাহ" for good effort.
          - SUBCONSCIOUS DAWAH: If the user talks about a problem, offer a solution mixed with Islamic wisdom (e.g., patience, trust in Allah). 
          - **MANDATORY**: Use the mindset of an Islamic activist—inspire the student through your beautiful manners (Akhlaq).

        [OUTPUT JSON FORMAT]
        {
            "conversation": "Actor's English reply",
            "learning_note": "Mentor's wise Bangla feedback",
            "score_added": 10 or 0
        }
        `;

        const messages = [
            { role: "system", content: masterPrompt },
            { role: "user", content: isStart ? "Initiate Scenario now." : `User says: "${message}"` }
        ];
        
        const rawResponse = await callGroq(messages, 0.7);
        
        let parsedData;
        try { 
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { conversation: safeString(rawResponse), learning_note: "চালিয়ে যান।", score_added: 0 };
        } catch (e) {
            parsedData = { conversation: "I'm listening, go on.", learning_note: "বুঝতে পারিনি, আবার বলুন।", score_added: 0 }; 
        }

        db[userId].history.push({ role: 'User', content: message });
        db[userId].history.push({ role: 'Actor', content: parsedData.conversation });
        if (db[userId].history.length > 10) db[userId].history = db[userId].history.slice(-10);

        if (!isStart && parsedData.score_added > 0) {
            db[userId].lifetime_score = (db[userId].lifetime_score || 0) + parsedData.score_added;
        }
        saveDB(db);

        res.json({ 
            reply: cleanUnicode(parsedData.conversation), 
            instruction: cleanUnicode(parsedData.learning_note),
            score_added: parsedData.score_added || 0,
            new_total_score: db[userId].lifetime_score
        });

    } catch (err) {
        console.error("Mastery Engine Error:", err.message);
        res.json({ reply: "Connection unstable.", instruction: "নেটওয়ার্ক সমস্যা, আবার বলুন।" });
    }
});

// ... (Admin Dashboard remains the same)

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.1-8b-instant", 
            max_tokens: 1024,
            temperature: temp,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${apiKey}` }, timeout: 25000 });
        return response.data.choices[0].message.content;
    } catch (err) { throw new Error("AI Failed"); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Islamic Mastery Engine running on port ${PORT}`));
