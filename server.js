const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🔧 FIX UNICODE ISSUES (Bangla Rendering)
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
    let dynamicTemp = 0.5; // Balanced for stability
    const lowerMood = mood.toLowerCase();
    if (lowerMood.includes('fun')) dynamicTemp = 0.8;
    else if (lowerMood.includes('serious')) dynamicTemp = 0.3;

    const isStart = message === "Action!";

    try {
        // 🧠 SUPER PROMPT: DUAL LOGIC (Actor + Teacher)
        
        let finalPrompt = "";

        if (isStart) {
            // 🚀 START MODE: AI MUST SPEAK FIRST
            finalPrompt = `
            ${systemInstruction}
            [INSTRUCTION]: This is the START of the conversation. 
            1. As the Roleplay Character, generate a natural opening line based on the Scene.
            2. As the Mentor, output EXACTLY this fixed Bangla welcome: "আসসালামু আলাইকুম! শুরু করা যাক। ভয় নেই, ভুল হলে আমি আছি। মনে রাখবেন, Time is Life! উচ্চলয়ে কথা শুরু করুন।"
            
            [OUTPUT FORMAT]: JSON Only.
            {
                "conversation": "Opening line as the Roleplay Character...",
                "learning_note": "The fixed Bangla welcome message..."
            }`;
        } else {
            // 🔄 CONTINUOUS MODE: REVIEW & TEACH
            finalPrompt = `
            ${systemInstruction}
            
            [ROLEPLAY RULE]:
            - Act as the assigned character.
            - If user mentions Forbidden Topics (Atheism/Music/Fahisha), politely DODGE and return to business.
            
            [MENTOR RULE (Saifur Sir Persona)]:
            - You are 'Talk24AI Mentor'.
            - TASK 1: Analyze the user's last English sentence.
            - TASK 2: In the 'learning_note', write in BANGLA (using English terms for examples).
            - Explain if the sentence was correct or wrong.
            - Teach a BETTER or MORE POLITE way to say it.
            - Example format: "আপনার শেষ বাক্যটি ছিল... এটি মোটামুটি ঠিক, তবে আরো সুন্দর করে বলা যায়: [Example]..."
            
            [OUTPUT FORMAT]: JSON Only.
            {
                "conversation": "Your reply to the user as the Roleplay Character...",
                "learning_note": "Your teaching feedback in Bangla..."
            }`;
        }

        const messages = [
            { role: "system", content: finalPrompt },
            { role: "user", content: isStart ? "Start the roleplay now." : message }
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

        // 🧹 Clean Bangla Text
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
            max_tokens: 650,
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Teacher Server running on http://localhost:${PORT}`));
