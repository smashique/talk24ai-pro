const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🔧 FIX UNICODE ISSUES
const cleanUnicode = (str) => {
    if (!str) return "";
    return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
        return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
    });
};

const sanitizeInput = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>?/gm, '').trim();
};

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, mood, userId } = req.body;

    message = sanitizeInput(message);
    systemInstruction = sanitizeInput(systemInstruction);
    mood = sanitizeInput(mood) || 'Normal';

    // 🌡️ TEMPERATURE SETTINGS
    let dynamicTemp = 0.5; 
    if (mood.toLowerCase().includes('fun')) dynamicTemp = 0.8;

    // CHECK IF THIS IS THE START
    const isStart = message === "Action!";

    try {
        // 🧠 SUPER PROMPT: INITIATION & LANGUAGE CONTROL
        
        let finalPrompt = "";

        if (isStart) {
            // 🚀 FORCE START PROMPT
            finalPrompt = `
            ${systemInstruction}
            
            [CRITICAL TASK]: The user has just started the session. You MUST speak first.
            
            [AGENT A - ROLEPLAY ACTOR]:
            - Generate a warm, short opening line based on your Role and the Scene.
            - Language: ENGLISH ONLY.
            - Example: "Hello! Welcome to my shop. How can I help you?" or "Good morning. Please have a seat."
            
            [AGENT B - MENTOR]:
            - Output EXACTLY this Bangla text: "আসসালামু আলাইকুম! সময় হলো জীবন। তাই এক মুহূর্তও নষ্ট না করে চলো প্র্যাকটিস শুরু করি। ভয় পাবে না, আমি আছি।"
            
            [OUTPUT JSON ONLY]:
            {
                "conversation": "Write English opening line here...",
                "learning_note": "Write Bangla welcome here..."
            }`;
        } else {
            // 🔄 CONTINUOUS CHAT PROMPT
            finalPrompt = `
            ${systemInstruction}
            
            [AGENT A - ROLEPLAY ACTOR]:
            - Act as the character. Keep replies natural (A2/B1 Level).
            - Language: **ENGLISH ONLY**. Never use Bangla in 'conversation'.
            - If user talks about Forbidden Topics (Atheism/Music/Fahisha), politely dodge/ignore in English.
            
            [AGENT B - MENTOR (Saifur Sir + Scholar)]:
            - Language: **BANGLA ONLY**.
            - Analyze user's last English sentence. Correct errors or suggest better words.
            - If user is lazy/wasting time -> Scold gently ("Time is Life").
            
            [OUTPUT JSON ONLY]:
            {
                "conversation": "English response...",
                "learning_note": "Bangla feedback..."
            }`;
        }

        const messages = [
            { role: "system", content: finalPrompt },
            { role: "user", content: isStart ? "Start the conversation now. You speak first." : message }
        ];

        const rawResponse = await callGroq(messages, dynamicTemp);
        
        let parsedData;
        try {
            const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Error:", e.message);
            parsedData = { 
                conversation: "Hello! I am ready to start. How are you?", 
                learning_note: "যান্ত্রিক ত্রুটির কারণে নোট লোড হয়নি। তবে চলুন শুরু করি!" 
            };
        }

        // 🛡️ SAFETY CHECK: IF AI RETURNS EMPTY START MESSAGE
        if (isStart && (!parsedData.conversation || parsedData.conversation.length < 2)) {
            parsedData.conversation = "Hello! I am ready. Shall we start?";
        }

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
            max_tokens: 850,
            temperature: temp,
            response_format: { type: "json_object" }
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        throw new Error("AI Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Force-Start Server running on http://localhost:${PORT}`));
