const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * ⛔ IRON-CLAD GUARDRAILS (GB APPROVED)
 * Banned Keywords List for Roles & Topics
 */
const BANNED_TERMS = [
    // Relationships
    'girlfriend', 'boyfriend', 'lover', 'wife', 'husband', 'spouse', 'dating', 
    'bf', 'gf', 'bae', 'crush', 'partner', 
    // Sensitive/Adult Topics
    'sex', 'intimacy', 'kiss', 'romance', 'nude', 'adult', 'porn', 'erotic'
];

/**
 * 🔒 SECURITY FILTER FUNCTION
 * Returns TRUE if content is safe, FALSE if violation found.
 */
const isContentSafe = (text) => {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    // Check if any banned term exists in the text
    const violation = BANNED_TERMS.find(term => lowerText.includes(term));
    return !violation; 
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

/**
 * 🧠 MASTER SERVER (SECURE & COMPLIANT)
 */
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);

    // 🚨 1. HARAM & SAFETY CHECK (Pre-LLM Filter)
    // If user tries to set "Girlfriend" role or talks about "Sex", BLOCK IT immediately.
    if (!isContentSafe(systemInstruction) || !isContentSafe(message)) {
        return res.json({ 
            reply: "I cannot continue this conversation due to ethical guidelines. Please change the topic or role. (Restricted: Sensitive Content)" 
        });
    }

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
        res.status(500).json({ reply: "System update in progress. Please try again." });
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Secure Server running on http://localhost:${PORT}`));
