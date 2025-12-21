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

// 🔧 NEW HELPER: Fixes Broken Unicode (e.g., \u0995 -> ক)
const cleanUnicode = (str) => {
    if (!str) return "";
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
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
    let dynamicTemp = 0.5; // Lowered slightly to reduce hallucination (gibberish)
    const lowerMood = mood.toLowerCase();
    if (lowerMood.includes('fun') || lowerMood.includes('crazy')) dynamicTemp = 0.8;
    else if (lowerMood.includes('serious')) dynamicTemp = 0.3;

    const isStart = message === "Action!";

    try {
        // 🧠 IDEOLOGICAL MENTOR PROMPT (STABILIZED)
        
        // 1. DUAL BEHAVIOR PROTOCOL
        const roleplayDirectives = `
        You are strictly playing the assigned role. 
        [HANDLING SENSITIVE TOPICS]:
        If user mentions Atheism, Darwinism, Democracy, Socialism, Big Bang, Music, or Sexual/Sensual topics:
        - DO NOT lecture. DO NOT engage in debate.
        - SMARTLY DODGE the topic and steer back to the scenario.
        `;

        // 2. MENTOR INSTRUCTION (Fixing Gibberish)
        const mentorDirectives = `
        You are 'Talk24AI Mentor' (Persona: S@ifur Sir + Islamic Scholar).
        Your job is to guide the user in the "learning_note" field.
        
        [STRICT LANGUAGE RULES]:
        1. Write ONLY in **Standard Formal Bengali** (প্রমিত বাংলা).
        2. DO NOT use gibberish, broken words, or hallucinated terms.
        3. Do NOT use Unicode escape codes (like \\u09...). Write raw Bangla characters.
        
        [LOGIC PROTOCOL]:
        - IF Sensitive Topic (Music/Atheism/etc): Politely correct their worldview using Logic/Islam in Bangla.
        - IF Normal Topic: Review grammar briefly. Give a hint for the next answer.
        - TONE: Caring but Focused on "Time is Life".
        `;

        // Fixed Start Message to prevent initial glitch
        const startMessageScript = "মাশাআল্লাহ! দুর্দান্ত উদ্যোগ! সময় নষ্ট না করে চলো প্র্যাকটিস শুরু করি। Time is Life!";

        const finalSystemPrompt = isStart 
            ? `This is the START. Output JSON with conversation="" and learning_note="${startMessageScript}"`
            : `${systemInstruction} 
               ${roleplayDirectives}
               
               [CRITICAL OUTPUT RULE]: Return valid JSON only.
               Structure:
               {
                   "conversation": "Your Roleplay response in English (A2/B1 Level). Dodge sensitive topics if present. End with a question.",
                   "learning_note": "${mentorDirectives}"
               }`;

        const messages = [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: message }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse Fail:", e.message);
            // Fallback that still tries to be helpful
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "নেটওয়ার্ক সমস্যার কারণে নোট লোড হয়নি। তবে চালিয়ে যান! Time is Life!" 
            };
        }

        // 🧹 FINAL CLEANING STEP
        // Ensure Bangla text is readable and fixed
        const fixedConversation = cleanUnicode(parsedData.conversation);
        const fixedInstruction = cleanUnicode(parsedData.learning_note);

        res.json({ 
            reply: fixedConversation, 
            instruction: fixedInstruction 
        });

    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ reply: "Connection error.", instruction: "আবার চেষ্টা করুন।" });
    }
});

async function callGroq(messages, temp) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile",
            max_tokens: 600,
            temperature: temp,
            response_format: { type: "json_object" }
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Stabilized Server running on http://localhost:${PORT}`));
