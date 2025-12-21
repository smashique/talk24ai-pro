const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * 🔓 UNRESTRICTED SERVER WITH SMART MOOD
 * - Adapts 'Temperature' based on User's Mood
 */

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
        return res.status(400).json({ reply: "Please say something!" });
    }

    // 🌡️ DYNAMIC TEMPERATURE LOGIC
    // Fun/Crazy = High Temp (More Creative/Random)
    // Serious/Professional = Low Temp (Focused/Strict)
    let dynamicTemp = 0.7; // Default
    const lowerMood = mood.toLowerCase();

    if (lowerMood.includes('fun') || lowerMood.includes('crazy') || lowerMood.includes('joke')) {
        dynamicTemp = 0.9; // High creativity
    } else if (lowerMood.includes('serious') || lowerMood.includes('professional') || lowerMood.includes('interview')) {
        dynamicTemp = 0.3; // High focus
    }

    try {
        const messages = [
            { 
                role: "system", 
                content: (systemInstruction || "You are Talk24AI.") + 
                `\n[CURRENT MOOD/TONE]: ${mood}. Adjust your style accordingly.`
            },
            { 
                role: "user", 
                content: message 
            }
        ];

        const reply = await callGroq(messages, dynamicTemp);
        res.json({ reply });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ reply: "Connection error. Please try again." });
    }
});

// --- AI ENGINE ---
async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", 
            max_tokens: 350, 
            temperature: temp // Using the dynamic temperature
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("❌ Groq API Error:", err.response ? err.response.data : err.message);
        throw new Error("AI Connection Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Mood-Adaptive Server running on http://localhost:${PORT}`));
