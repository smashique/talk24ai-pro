const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * ⛔ SMART GUARDRAILS (REGEX UPDATED)
 * Using "Whole Word" matching to avoid blocking innocent words.
 * Example: Blocks "sex" but Allows "section", "assessment", "sussex".
 */
const BANNED_TERMS = [
    // Explicit Relationships
    'girlfriend', 'boyfriend', 'lover', 'dating', 'bae', 'crush', 'making love', 'spouse', 'wife', 'husband',
    // Sensitive/Adult Topics
    'sex', 'intimacy', 'nude', 'porn', 'erotic', 'xxx', 'sexual'
];

/**
 * 🔒 SECURITY FILTER FUNCTION
 * Uses Regex \b (Word Boundary) to ensure we only block exact bad words.
 */
const isContentSafe = (text) => {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    
    // Check for exact word matches using Regex
    const violation = BANNED_TERMS.find(term => {
        // \b ensures word boundary. Example: Matches "sex" but not "section"
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        return regex.test(lowerText);
    });
    
    if (violation) {
        console.log(`⚠️ Blocked Content: Found restricted word "${violation}"`);
    }
    return !violation; 
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

/**
 * 🧠 MASTER SERVER
 */
app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);

    // 🚨 SAFETY CHECK
    // If user's message OR the setup context contains explicit banned words -> BLOCK
    if (!isContentSafe(message) || !isContentSafe(systemInstruction)) {
        return res.json({ 
            reply: "I cannot continue this conversation due to ethical guidelines. Please change the topic or role. (Restricted Content)" 
        });
    }

    if (!message) {
        return res.status(400).json({ reply: "Please say something!" });
    }

    try {
        const messages = [
            { 
                role: "system", 
                // GB APPROVED: SIMPLE ENGLISH INSTRUCTION
                content: (systemInstruction || "You are Talk24AI.") + 
                "\n[IMPORTANT RULE]: Use SIMPLE, BEGINNER-FRIENDLY English (Level A2-B1). Keep sentences short. Always end with a question."
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Stable Server running on http://localhost:${PORT}`));
