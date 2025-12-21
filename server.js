const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * 🔓 UNRESTRICTED SERVER
 * - No Banned Words List
 * - No Content Filtering
 * - Direct Pass-through to AI
 */

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    // Basic cleanup to prevent code injection, but NO content filtering
    return text.replace(/<[^>]*>?/gm, '').trim();
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);

    if (!message) {
        return res.status(400).json({ reply: "Please say something!" });
    }

    try {
        const messages = [
            { 
                role: "system", 
                // Core instruction only - No restrictions added here
                content: (systemInstruction || "You are Talk24AI.") + 
                "\n[INSTRUCTION]: Respond naturally to the user's scenario."
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
        res.status(500).json({ reply: "Connection error. Please try again." });
    }
});

// --- AI ENGINE ---
async function callGroq(messages) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", 
            max_tokens: 350, 
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Unrestricted Server running on http://localhost:${PORT}`));
