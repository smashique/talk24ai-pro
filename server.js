// ... (পূর্বের ডাটাবেস ও কনফিগ কোড একই থাকবে)

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId, inputType } = req.body; // inputType: 'click' or 'voice'
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        // 🧠 MASTER PROMPT WITH REWARD LOGIC
        const masterPrompt = `
        [IDENTITY] Proactive English Mentor. Muslim.
        [RULE] If the user speaks well, recommend 10 base XP.
        [BONUS] In your "notes", always encourage them: "Speak via Mic for Double Points!" if they are just clicking.
        
        [STRICT JSON FORMAT]
        {
          "reply": "Character message + [A. Option 1 | B. Option 2]",
          "performance": "Assessment text...",
          "notes": "Mentoring feedback + Points hint",
          "base_xp": 10
        }`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: message }],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` } });

        const result = JSON.parse(response.data.choices[0].message.content);
        
        // 💰 DOUBLE XP LOGIC
        let finalXP = result.base_xp || 10;
        if (inputType === 'voice') finalXP *= 2; // মুখে বললে দ্বিগুণ পয়েন্ট

        user.lifetime_score += finalXP;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.performance, 
            notes: result.notes, 
            score_added: finalXP, 
            new_total_score: user.lifetime_score,
            is_bonus: inputType === 'voice' 
        });
    } catch (err) { res.json({ reply: "Connection blink! Try again." }); }
});

// ... (stats endpoint)
