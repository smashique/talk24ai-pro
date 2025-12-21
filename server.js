const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * 🧠 TALK24AI SERVER (UPDATED FOR SCENE CONTEXT)
 * - Unlimited Free Access (God Mode)
 * - Handles Dynamic System Prompts with Situational Context
 */

app.post('/api/chat', async (req, res) => {
    // Frontend sends: { message, systemInstruction }
    const { message, systemInstruction } = req.body;

    try {
        const messages = [
            { 
                role: "system", 
                // The frontend now sends a highly detailed prompt including the 'Situation'
                content: systemInstruction || "You are Talk24AI, a helpful English conversation partner." 
            },
            { 
                role: "user", 
                content: message 
            }
        ];

        const reply = await callGroq(messages);
        res.json({ reply });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ reply: "My brain is updating! Please try again in a moment." });
    }
});

// --- AI ENGINE (High Speed Llama 3.3) ---
async function callGroq(messages) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", 
            max_tokens: 350, // Increased token limit for better storytelling
            temperature: 0.7 
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Server running on http://localhost:${PORT}`));
