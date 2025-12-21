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

    try {
        const messages = [
            { 
                role: "system", 
                content: (systemInstruction || "You are Talk24AI.") + 
                `\n[CURRENT MOOD]: ${mood}.
                
                [CRITICAL OUTPUT RULE]: You MUST return the response in valid JSON format strictly. Do not add any markdown.
                Structure:
                {
                    "conversation": "Your English response to the user (A2/B1 Level). End with a question.",
                    "learning_note": "Write in Bangla (mix with English terms). 1. Praise/Review user's last sentence (Correct errors if any). 2. Give a Hint/Instruction on how to answer your question."
                }`
            },
            { 
                role: "user", 
                content: message 
            }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        // 🧩 JSON PARSING LOGIC
        let parsedData;
        try {
            // Sometimes AI adds ```json ... ``` wrapper, remove it
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            // Fallback if JSON breaks
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "ফিডব্যাক লোড করা যায়নি, তবে আপনি চালিয়ে যান!" 
            };
        }

        res.json({ 
            reply: parsedData.conversation, 
            instruction: parsedData.learning_note 
        });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ reply: "Connection error.", instruction: "Try again." });
    }
});

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile",
            max_tokens: 450, // Increased for JSON
            temperature: temp,
            response_format: { type: "json_object" } // Force JSON Mode
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Dual-Mode Server running on http://localhost:${PORT}`));
