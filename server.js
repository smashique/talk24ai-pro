const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * 🧠 MASTER SERVER LOGIC (ALIGNED WITH CREATIVE MODE)
 * - No Database Restrictions (True Unlimited)
 * - Dynamic System Prompting (Accepts 'systemInstruction' from Frontend)
 * - High-Speed Llama-3.3-70b Engine
 */

app.post('/api/chat', async (req, res) => {
    // Frontend sends: { message, systemInstruction }
    const { message, systemInstruction } = req.body;

    try {
        // 1. Construct the Intelligence Chain
        const messages = [
            { 
                role: "system", 
                // Use the Dynamic Prompt from Frontend OR Fallback to a default Master Prompt
                content: systemInstruction || "You are Talk24AI, a helpful English conversation partner." 
            },
            { 
                role: "user", 
                content: message 
            }
        ];

        // 2. Call the AI Engine (Groq High-Speed)
        const reply = await callGroq(messages);

        // 3. Return Response (No quota checks, purely functionality)
        res.json({ reply });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ reply: "I am upgrading my brain cells! Please try again in a second." });
    }
});

// --- AI ENGINE CONNECTION ---
async function callGroq(messages) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", // Best balance of IQ and Speed
            max_tokens: 300, // Sufficient for creative storytelling
            temperature: 0.7 // Creative but stable
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Creative Server running on http://localhost:${PORT}`));
