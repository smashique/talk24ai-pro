const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * 🔒 SECURITY LAYER (GB APPROVED)
 * Sanitize input to prevent Script Injection & XSS Attacks
 */
const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    // Remove HTML tags and dangerous characters
    return text.replace(/<[^>]*>?/gm, '').trim();
};

/**
 * 🧠 TALK24AI SERVER (CREATIVE + SECURE)
 * - Unlimited Free Access (God Mode)
 * - Dynamic Context with Security Filters
 */
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction } = req.body;

    // 🛡️ SECURITY CHECK
    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);

    if (!message) {
        return res.status(400).json({ reply: "Please say something!" });
    }

    try {
        const messages = [
            { 
                role: "system", 
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Secure Server running on http://localhost:${PORT}`));
