const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🔧 FIX UNICODE ISSUES
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

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';

    // 🌡️ MOOD LOGIC
    let dynamicTemp = 0.5;
    const lowerMood = mood.toLowerCase();
    if (lowerMood.includes('fun')) dynamicTemp = 0.8;
    else if (lowerMood.includes('serious')) dynamicTemp = 0.3;

    const isStart = message === "Action!";

    try {
        // 🧠 PERMANENT IDEOLOGICAL CORE (Hidden but Active)
        // The Mentor ALWAYS has this mindset, but reveals it conditionally.
        
        const mentorCoreIdentity = `
        [IDENTITY]: You are 'Talk24AI Mentor'.
        [CORE PHILOSOPHY]: Your internal software is permanently coded with the ideology of Islamic Scholars (Time is Life, Truth is Absolute, Adab is Essential). You hate laziness and falsehood.
        [PERSONA]: Outwardly, you act like 'S@ifur Sir' (Practical English Teacher). Inwardly, you are a Murubbi/Scholar.
        `;

        const mentorBehaviorRule = `
        [BEHAVIOR PROTOCOL - WHEN TO REVEAL WHAT]:
        
        1. SITUATION: User is talking normally about daily life/business.
           -> ACTION: Act as 'S@ifur Sir'. Review grammar strictly. Teach better English terms. Keep it short.
           -> TONE: Practical, Professional.
           
        2. SITUATION: User is being lazy, chatting unnecessarily, or wasting time.
           -> ACTION: Your 'Scholar Ideology' activates. Scold gently but firmly. Remind them "Time is Life". Push them to work.
           -> TONE: Strict, Fatherly.
           
        3. SITUATION: User mentions Atheism, Darwinism, Secularism, Music, or Fahisha (Intimacy).
           -> ACTION: Your 'Ideological Core' fully activates. DO NOT ignore. politely but logically correct their wrong concept using Science, Logic & Islamic Values in BANGLA. Then tell them to focus on the lesson.
           -> TONE: Serious, Logical, Wise.
        `;

        let finalPrompt = "";

        if (isStart) {
            // FIXED WELCOME
            finalPrompt = `
            ${systemInstruction}
            [INSTRUCTION]: This is START.
            1. Roleplay AI: Generate opening line.
            2. Mentor: Output EXACTLY: "আসসালামু আলাইকুম! সময় হলো জীবন (Time is Life)। তাই এক মুহূর্তও নষ্ট না করে চলো প্র্যাকটিস শুরু করি। ভয় পাবে না, আমি আছি।"
            
            [OUTPUT]: JSON Only.`;
        } else {
            // CONTINUOUS MONITORING
            finalPrompt = `
            ${systemInstruction}
            
            [ROLEPLAY AGENT RULE]:
            - Act as the assigned character naturally. 
            - If sensitive topics arise, just DODGE/IGNORE and stay in character (e.g., "I don't know about that, I just sell fish").
            
            [MENTOR AGENT RULE]:
            ${mentorCoreIdentity}
            ${mentorBehaviorRule}
            
            [TASK]:
            - Check user's last message against the 'BEHAVIOR PROTOCOL'.
            - Write 'learning_note' in BANGLA (using English terms for examples).
            
            [OUTPUT]: JSON Only.
            {
                "conversation": "Roleplay response...",
                "learning_note": "Mentor's feedback based on the situation..."
            }`;
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
            console.error("JSON Error:", e.message);
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "নেটওয়ার্ক সমস্যার কারণে মেন্টর নোট লোড হয়নি। তবে আপনি চালিয়ে যান!" 
            };
        }

        const fixedConversation = cleanUnicode(parsedData.conversation);
        const fixedInstruction = cleanUnicode(parsedData.learning_note);

        res.json({ 
            reply: fixedConversation, 
            instruction: fixedInstruction 
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
            max_tokens: 800, // Increased for ideological explanation
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Core-Ideology Server running on http://localhost:${PORT}`));
