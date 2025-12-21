const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * ⛔ SMART GUARDRAILS
 * Restricted terms to ensure safety and Shariah compliance.
 */
const BANNED_TERMS = [
    'girlfriend', 'boyfriend', 'lover', 'dating', 'bae', 'crush', 'making love',
    'sex', 'intimacy', 'nude', 'porn', 'erotic', 'xxx'
];

const isContentSafe = (text) => {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    const violation = BANNED_TERMS.find(term => lowerText.includes(term));
    return !violation; 
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

/**
 * 🧠 MASTER SERVER (USER-CENTRIC UPDATE)
 * - Optimized for Beginner Friendly English (A2/B1 Level)
 */
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);

    // 🚨 SAFETY CHECK
    if (!isContentSafe(message) || !isContentSafe(systemInstruction)) {
        return res.json({ 
            reply: "I cannot continue this conversation due to ethical guidelines. Please change the topic. (Restricted Content)" 
        });
    }

    if (!message) {
        return res.status(400).json({ reply: "Please say something!" });
    }

    try {
        const messages = [
            { 
                role: "system", 
                // GB APPROVED INSTRUCTION: SIMPLE ENGLISH
                content: (systemInstruction || "You are Talk24AI.") + 
                "\n[IMPORTANT RULE]: Use SIMPLE, BEGINNER-FRIENDLY English (Level A2-B1). Avoid complex vocabulary. Keep sentences short and clear."
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
        res.status(500).json({ reply: "Connection glitch! Please try again." });
    }
});

// --- AI ENGINE ---
async function callGroq(messages) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", 
            max_tokens: 300, 
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Optimized Server running on http://localhost:${PORT}`));
