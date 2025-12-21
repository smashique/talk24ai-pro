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

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';

    if (!message) {
        return res.status(400).json({ reply: "Please say something!", instruction: "দয়া করে কিছু বলুন।" });
    }

    // 🌡️ MOOD LOGIC
    let dynamicTemp = 0.7;
    const lowerMood = mood.toLowerCase();
    if (lowerMood.includes('fun') || lowerMood.includes('crazy')) dynamicTemp = 0.9;
    else if (lowerMood.includes('serious') || lowerMood.includes('inspiring')) dynamicTemp = 0.4;

    const isStart = message === "Action!";

    try {
        // 🧠 SUPER PROMPT: DUAL BEHAVIOR PROTOCOL
        
        // 1. ROLEPLAY INSTRUCTION (Dodge & Deflect)
        const roleplayDirectives = `
        You are strictly playing the assigned role. 
        [HANDLING SENSITIVE TOPICS]:
        If the user mentions Atheism, Darwinism, Democracy, Socialism, Big Bang, Music, Sexual/Sensual topics, or anything conflicting with Islamic values:
        - DO NOT lecture or preach.
        - DO NOT engage in the debate.
        - SMARTLY DODGE the topic and steer the conversation back to the current scenario/business immediately.
        - Act as if you are busy or focused on the task at hand.
        `;

        // 2. MENTOR INSTRUCTION (Correct & Educate)
        const mentorDirectives = `
        You are 'Talk24AI Mentor' (Persona: S@ifur Sir + Islamic Scholar).
        Your job is to guide the user in the "learning_note" JSON field (Write in BANGLA SCRIPT).
        
        [LOGIC & CORRECTION PROTOCOL]:
        Check if the user's message contains: Atheism, Darwinism, Democracy, Socialism, Big Bang, Music, or Intimacy/Fahisha.
        
        - IF YES: Ignore the grammar for a moment. politely but logically correct their worldview using Science, Logic, Quran, or Sunnah. Explain why it is harmful or incorrect. Then tell them to focus on the English lesson.
        - IF NO (Normal msg): Briefly review their English grammar/vocab in Bangla. Give a hint for the next answer.
        
        Tone: Caring, Logical, Inspiring (Time is Life).
        `;

        const finalSystemPrompt = isStart 
            ? `This is the START. Do NOT generate conversation. Output JSON with conversation="" and learning_note="মাশাআল্লাহ! দুর্দান্ত উদ্যোগ! সময় নষ্ট না করে চলো প্র্যাকটিস শুরু করি। Time is Life!"`
            : `${systemInstruction} 
               ${roleplayDirectives}
               
               [CRITICAL OUTPUT RULE]: Return valid JSON only.
               Structure:
               {
                   "conversation": "Your Roleplay response in English (A2/B1 Level). Dodge sensitive topics if present. End with a question.",
                   "learning_note": "${mentorDirectives}"
               }`;

        const messages = [
            { 
                role: "system", 
                content: finalSystemPrompt
            },
            { 
                role: "user", 
                content: message 
            }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            // Fallback strategy if JSON fails
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "নেটওয়ার্ক সমস্যার কারণে মেন্টর নোট লোড হয়নি। তবে আপনি চালিয়ে যান! Time is Life!" 
            };
        }

        res.json({ 
            reply: parsedData.conversation, 
            instruction: parsedData.learning_note 
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
            max_tokens: 650, // Increased token limit for logical explanations
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Dual-Logic Server running on http://localhost:${PORT}`));
