const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * ⛔ SMART GUARDRAILS (GB APPROVED & REFINED)
 * Removed common words like "partner" to avoid false blocking.
 * Added strict checks only for explicit romantic/adult terms.
 */
const BANNED_TERMS = [
    // Explicit Relationships (Removed 'partner', 'wife', 'husband' to allow general conversation context if needed, but kept strict dating terms)
    'girlfriend', 'boyfriend', 'lover', 'dating', 'bae', 'crush', 'making love',
    // Sensitive/Adult Topics
    'sex', 'intimacy', 'nude', 'porn', 'erotic', 'xxx'
];

/**
 * 🔒 SECURITY FILTER FUNCTION
 * Returns TRUE if content is safe.
 */
const isContentSafe = (text) => {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    
    // Check if any banned term exists as a distinct word or explicitly in the text
    const violation = BANNED_TERMS.find(term => lowerText.includes(term));
    
    if (violation) {
        console.log(`⚠️ Blocked content due to keyword: ${violation}`); // For debugging on server console
    }
    return !violation; 
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);

    // 🚨 SAFETY CHECK
    // We check the USER'S message strictly.
    // We relax the check on systemInstruction slightly to allow standard prompts, unless it has explicit bad words.
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Smart Server running on http://localhost:${PORT}`));
