const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';

    if (!message) {
        return res.status(400).json({ reply: "Please say something!", instruction: "দয়া করে কিছু বলুন।" });
    }

    // 🌡️ MOOD LOGIC
    let dynamicTemp = 0.7;
    const lowerMood = mood.toLowerCase();
    if (lowerMood.includes('fun') || lowerMood.includes('crazy')) dynamicTemp = 0.9;
    else if (lowerMood.includes('serious')) dynamicTemp = 0.3;

    // 🚀 FIRST MESSAGE CHECK
    // If message is "Action!", it means the chat just started.
    const isStart = message === "Action!";

    try {
        // 🧠 MENTOR INSTRUCTION (SAIFUR SIR PERSONA)
        const mentorPrompt = isStart 
            ? "This is the START of the session. Do NOT review anything. As 'Talk24AI Mentor' (Saifur Sir), give a short, energetic welcome in BANGLA SCRIPT. Tell them to start speaking fearlessly." 
            : "1. As 'Talk24AI Mentor' (Saifur Sir), review the user's last sentence. If there are grammar mistakes, correct them gently in BANGLA SCRIPT. 2. Give a hint in BANGLA on how to answer the current question clearly.";

        const messages = [
            { 
                role: "system", 
                content: (systemInstruction || "You are Talk24AI.") + 
                `\n[CURRENT MOOD]: ${mood}.
                
                [CRITICAL OUTPUT RULE]: Return valid JSON only.
                Structure:
                {
                    "conversation": "Your Roleplay response in English (A2/B1 Level). End with a question.",
                    "learning_note": "${mentorPrompt} (Write ONLY in Bangla Script using simple terms)."
                }`
            },
            { 
                role: "user", 
                content: message 
            }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "টেকনিক্যাল সমস্যার কারণে মেন্টর টিপস লোড হয়নি। আপনি চালিয়ে যান!" 
            };
        }

        res.json({ 
            reply: parsedData.conversation, 
            instruction: parsedData.learning_note 
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
            max_tokens: 450,
            temperature: temp,
            response_format: { type: "json_object" }
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("❌ Groq API Error:", err.message);
        throw new Error("AI Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Mentor Server running on http://localhost:${PORT}`));
