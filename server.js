// ... (পূর্বের কানেকশন কোড একই থাকবে)

app.post('/api/chat', async (req, res) => {
    let { message, systemInstruction, userId, inputType } = req.body; 
    const trackCode = systemInstruction.match(/Skill Level: ([A-D])/) ? systemInstruction.match(/Skill Level: ([A-D])/)[1] : 'A';
    const topicMatch = message.match(/Mission Start: (.+)/);
    const currentTopic = topicMatch ? topicMatch[1] : "General Practice";
    const isStart = !!topicMatch || message === "Action!";

    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const masterPrompt = `
        [IDENTITY] World-class Spoken English Character Actor. Muslim. ONLY English.
        [TASK] Act as a character for the topic: "${currentTopic}". 
        
        [STRICT RESPONSE RULE - CRITICAL]
        Your reply MUST ALWAYS end with two simple response options for the user in brackets.
        Example Format: "I love teaching! Do you like your school? [A. Yes, it is fun! | B. No, I prefer holidays]"

        [JSON OUTPUT STRUCTURE]
        {
          "reply": "Immersive dialogue + Engaging Question + [A. Option 1 | B. Option 2]",
          "performance": "Assess user's input: '${message}' (Fluency: X% | Grammar: Y% | Vocab: Z% | Status: ...)",
          "notes": "Mentoring: • Review: ...\\n• Tip: ...\\n• Next: ...",
          "xp": 10
        }`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? `Mission: ${currentTopic}` : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 25000 });

        const result = JSON.parse(response.data.choices[0].message.content);
        
        let points = result.xp || 10;
        if (inputType === 'voice') points *= 2; // 2X XP

        user.lifetime_score += points;
        await user.save();

        res.json({ 
            reply: result.reply, 
            performance: result.performance, 
            notes: result.notes, 
            score_added: points, 
            new_total_score: user.lifetime_score,
            streak: user.speak_streak || 0
        });
    } catch (err) { res.json({ reply: "I missed that! Can you say it again? [A. Sure thing! | B. Let's restart]", performance: "Syncing...", notes: "System error." }); }
});

// ... (stats endpoint)
