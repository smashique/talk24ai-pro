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
        // 🧠 IDEOLOGICAL MENTOR PROMPT (FIXED SCRIPT FOR START)
        // We force the AI to use a specific Bengali sentence at the start to prevent hallucination.
        
        let mentorInstruction = "";
        
        if (isStart) {
            // STRICT STARTING MESSAGE
            mentorInstruction = `This is the START. Do NOT generate new text. Output EXACTLY this Bengali text: "মাশাআল্লাহ! দুর্দান্ত উদ্যোগ! সময় নষ্ট না করে চলো প্র্যাকটিস শুরু করি। Time is Life!"`;
        } else {
            // DYNAMIC FEEDBACK FOR LATER MESSAGES
            mentorInstruction = `You are 'Talk24AI Mentor' (Saifur Sir + Islamic Scholar persona).
            1. Review user's last sentence briefly in BANGLA SCRIPT. If lazy, gently scold (Time is Life). If grammar error, correct it directly.
            2. Give a clear hint in BANGLA on how to answer the current question.
            Tone: Strict but caring.`;
        }

        const messages = [
            { 
                role: "system", 
                content: (systemInstruction || "You are Talk24AI.") + 
                `\n[CURRENT MOOD]: ${mood}.
                
                [CRITICAL OUTPUT RULE]: Return valid JSON only.
                Structure:
                {
                    "conversation": "Your Roleplay response in English (A2/B1 Level). Keep it natural. End with a question.",
                    "learning_note": "${mentorInstruction}"
                }`
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
            parsedData = { 
                conversation: rawResponse, 
                learning_note: "নেটওয়ার্ক সমস্যার কারণে মেন্টর নোট লোড হয়নি। চালিয়ে যান!" 
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
            max_tokens: 500,
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
app.listen(PORT, () => console.log(`🚀 Talk24Ai Stable Server running on http://localhost:${PORT}`));
