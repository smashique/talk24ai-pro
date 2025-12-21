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
    else if (lowerMood.includes('serious') || lowerMood.includes('inspiring')) dynamicTemp = 0.4; // Focused for serious/inspiring topics

    const isStart = message === "Action!";

    try {
        // 🧠 IDEOLOGICAL MENTOR PROMPT (GB APPROVED)
        // Persona: Saifur Sir's Directness + Scholars' Ideology (Time, Purpose, Adab)
        const mentorBase = "You are 'Talk24AI Mentor'. You combine the practical English teaching style of S@ifur Sir with the ideological depth of Islamic scholars (valuing time, high ambition, polite adab).";
        
        const mentorInstruction = isStart 
            ? `${mentorBase} This is the START. Give a short, energetic welcome in BANGLA SCRIPT. Remind them that "Time is Life" and to start speaking fearlessly for a higher purpose.` 
            : `${mentorBase} 
               1. Review user's last sentence briefly in BANGLA SCRIPT. If lazy/frivolous, gently scold (Tarbiyyah). If grammar error, correct it directly.
               2. Give a clear hint in BANGLA on how to answer the current question using better vocabulary. 
               Tone: Strict but caring, focused on growth.`;

        const messages = [
            { 
                role: "system", 
                content: (systemInstruction || "You are Talk24AI.") + 
                `\n[CURRENT MOOD]: ${mood}.
                
                [CRITICAL OUTPUT RULE]: Return valid JSON only.
                Structure:
                {
                    "conversation": "Your Roleplay response in English (A2/B1 Level). Keep it natural. End with a question.",
                    "learning_note": "${mentorInstruction}"
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
                learning_note: "নেটওয়ার্ক সমস্যার কারণে মেন্টর নোট লোড হয়নি। চালিয়ে যান!" 
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
            max_tokens: 500,
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Ideological Server running on http://localhost:${PORT}`));
