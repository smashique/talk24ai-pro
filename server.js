const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 1. Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Talk24Ai Database Connected Successfully!"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// 2. User Schema (Simplified & English)
const User = mongoose.model('User', {
    email: String,
    history: { type: Array, default: [] },
    dailyLimit: { type: Number, default: 999999 }, // Unlimited
    usedToday: { type: Number, default: 0 },
    lastActive: String,
    isPremium: { type: Boolean, default: true } // Default Premium Status
});

// 3. System Prompts (Refined by Prompt Experts)
const BASE_INSTRUCTION = `
You are 'Talk24AI', a friendly and intelligent English conversation partner from Bangladesh.

[CORE IDENTITY]
- Name: Talk24AI Mate.
- Origin: Bangladesh (You understand the culture but speak only English).
- Tone: Warm, encouraging, casual, and polite.

[STRICT BEHAVIORAL RULES]
1. GOD MODE (UNLIMITED): This service is 100% FREE. Never mention quotas, limits, or ask for money.
2. ENGAGEMENT HOOK: You MUST end every single response with a relevant, short, and open-ended QUESTION to keep the conversation flowing.
3. NO REPETITIVE GREETINGS: Do NOT start every message with "Assalamu Alaikum". Use it only if it feels natural in the very first interaction.
4. ROLEPLAY INTEGRITY: If assigned a role (e.g., Shopkeeper), stay in character. Do not break the fourth wall unless necessary.
5. SENSITIVE TOPICS: If asked for romantic (spouse/lover) or family (parent/child) roleplay, politely refuse by saying: "I cannot play that specific role. Let's try something else!"
6. CORRECTIONS: Do not lecture. If the user makes a significant grammar mistake, gently provide the correction in brackets at the very end. Example: (Correction: I went to the market).
`;

const USER_PROMPT = `${BASE_INSTRUCTION} 
Context: You are speaking with a registered user. Your goal is to help them practice fluency through natural conversation.`;

const GUEST_PROMPT = `${BASE_INSTRUCTION}
Context: You are speaking with a guest user. Be welcoming and helpful.`;

// 4. Chat API Route
app.post('/api/chat', async (req, res) => {
    const { email, message, isGuest } = req.body;

    try {
        // --- Guest Logic ---
        if (isGuest) {
            const reply = await callGroq([
                { role: "system", content: GUEST_PROMPT },
                { role: "user", content: message }
            ]);
            
            return res.json({ 
                reply, 
                isGuest: true,
                loginReminder: false 
            });
        }

        // --- Registered User Logic ---
        let user = await User.findOne({ email });
        const todayDate = new Date().toDateString();

        if (!user) {
            user = new User({ email, lastActive: todayDate });
        }

        // Reset counter on new day (Just for analytics, no limits enforced)
        if (user.lastActive !== todayDate) {
            user.usedToday = 0;
            user.lastActive = todayDate;
        }

        // User message history
        user.history.push({ role: "user", content: message });
        
        // Context Management (Keep last 12 messages for better memory)
        const context = user.history.slice(-12);

        // Call AI
        const reply = await callGroq([{ role: "system", content: USER_PROMPT }, ...context]);

        // Save history
        user.usedToday += 1;
        user.history.push({ role: "assistant", content: reply });
        await user.save();
        
        res.json({ 
            reply, 
            limitInfo: { 
                used: user.usedToday, 
                limit: "Unlimited", 
                remaining: "Unlimited" 
            } 
        });

    } catch (err) {
        console.error("Chat API Error:", err.message);
        res.status(500).json({ reply: "I'm having a bit of trouble connecting right now. Could you please try again?" });
    }
});

// 5. Groq API Function
async function callGroq(messages) {
    try {
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : "";
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: messages,
            model: "llama-3.3-70b-versatile", 
            max_tokens: 250, // Increased for detailed responses
            temperature: 0.7 // Balanced creativity
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        if (err.response) {
            console.error("Groq Cloud Error:", err.response.data);
        } else {
            console.error("Groq Connection Error:", err.message);
        }
        throw new Error("Groq Connection Failed");
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Talk24Ai Server running on http://localhost:${PORT}`));
