// ... আগের ইম্পোর্টগুলো ঠিক থাকবে ...

app.post('/api/chat', async (req, res) => {
    let { message, userId, inputType, mode } = req.body; 
    try {
        let user = await User.findOne({ userId }) || new User({ userId });
        
        let modeInstruction = "";
        if (mode === 'Junior') {
            modeInstruction = "Style: Simple English, short sentences, kid-friendly. Be a kind mentor.";
        } else if (mode === 'Pro') {
            modeInstruction = "Style: Advanced English, professional tone, IELTS/Business level.";
        } else {
            modeInstruction = "Style: Standard everyday English for general learners.";
        }

        const masterPrompt = `Role: Professional Male English Mentor.
        Instruction: 
        1. STRICTLY ENGLISH ONLY.
        2. FLOW: Give natural feedback on user effort, teach a small tip, and ask a question.
        3. IMPORTANT: DO NOT use labels like (Teach), (Review), or (Quiz). Do not use brackets [].
        4. OPTIONS: Provide 2-3 spoken practice options as a numbered list (e.g., 1. Option A, 2. Option B) at the very end.
        5. ${modeInstruction}
        Format: Return ONLY a JSON object with a "reply" field.`;

        const historyContext = user.history.slice(-6).map(h => ({ 
            role: h.role === 'User' ? 'user' : 'assistant', content: h.content 
        }));

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [
                { role: "system", content: masterPrompt },
                ...historyContext,
                { role: "user", content: message }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        let points = (inputType === 'voice') ? 10 : 2;

        user.history.push({ role: 'User', content: message }, { role: 'Assistant', content: result.reply });
        user.lifetime_score += points;
        await user.save();

        res.json({ reply: result.reply, score_added: points, new_total_score: user.lifetime_score });
    } catch (err) { 
        res.json({ reply: "I am ready. Shall we practice speaking? 1. Yes, let's start. 2. Sure!" }); 
    }
});
