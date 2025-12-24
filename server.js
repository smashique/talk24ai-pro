const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Kids Academy DB Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

// 📘 TRACK A: KIDS' MAGIC SPOKEN ENGLISH (1-100)
// Age Group: 6-10 Years | Style: Practical & Fun
const TRACK_A_CURRICULUM = {
    // Mission 1: My Tiny World (Level 1-25)
    1: { name: "Magic Hello", goal: "Say 'Assalamu Alaikum' and 'How are you?'.", user: "New Friend", actor: "Friendly Neighbor", skill: "Greetings" },
    2: { name: "Super Me!", goal: "Say 'I am [Name]' and 'I am a boy/girl'.", user: "Student", actor: "Teacher", skill: "Self Intro" },
    3: { name: "Abbu & Ammu", goal: "Say 'This is my Abbu/Ammu' to introduce parents.", user: "Kid", actor: "Guest", skill: "Family Intro" },
    4: { name: "My Toy Box", goal: "Say 'I have a ball' or 'I have a doll'.", user: "Playmate", actor: "Friend", skill: "I have..." },
    5: { name: "Rainbow Fun", goal: "Say 'It is a red apple' using colors.", user: "Small Artist", actor: "Art Mentor", skill: "It is [Color]" },
    // Mission 2: Action & Fun (Level 26-50)
    26: { name: "I Can Jump!", goal: "Say 'I can jump' or 'I can run'.", user: "Active Kid", actor: "Coach", skill: "I can [Action]" },
    27: { name: "Yummy Tummy", goal: "Say 'I like mango' or 'I like milk'.", user: "Hungry Child", actor: "Mother", skill: "I like [Food]" },
    28: { name: "Birdy Fly", goal: "Say 'The bird can fly' using animals.", user: "Nature Lover", actor: "Grandpa", skill: "Animals + Can" },
    29: { name: "Brushy Brush", goal: "Say 'I brush my teeth' for daily habits.", user: "Good Child", actor: "Dentist", skill: "Daily Actions" },
    30: { name: "Counting Stars", goal: "Say 'There are five stars' using numbers.", user: "Star Gazer", actor: "Wise Owl", skill: "There are..." },
    // Mission 3: Feelings (Level 51-75)
    51: { name: "Happy Heart", goal: "Say 'I am happy' or 'I am sleepy'.", user: "Little One", actor: "Grandma", skill: "Feelings" },
    52: { name: "Big & Small", goal: "Say 'The elephant is big' using adjectives.", user: "Zoo Visitor", actor: "Guide", skill: "Descriptions" },
    53: { name: "Cold Ice Cream", goal: "Say 'The ice cream is cold' for touch senses.", user: "Customer", actor: "Ice Cream Man", skill: "Sense Nouns" },
    54: { name: "Sweet Candy", goal: "Say 'The candy is sweet' for taste senses.", user: "Sweet Lover", actor: "Shopkeeper", skill: "Taste Nouns" },
    55: { name: "Quiet Mouse", goal: "Say 'Please be quiet' using polite words.", user: "Student", actor: "Librarian", skill: "Politeness" },
    // Mission 4: Little Storyteller (Level 76-100)
    76: { name: "Where is Kitty?", goal: "Ask 'Where is my cat?' to find things.", user: "Pet Owner", actor: "Brother", skill: "Where is...?" },
    77: { name: "Can I Play?", goal: "Ask 'Can I play with you?' politely.", user: "Kid at Park", actor: "New Friend", skill: "Can I...?" },
    78: { name: "Good Manners", goal: "Say 'Thank you' and 'JazakAllah' after help.", user: "Polite Kid", actor: "Elder Person", skill: "Islamic Manners" },
    99: { name: "My Big Story", goal: "Say three simple sentences about your day.", user: "Storyteller", actor: "Whole Family", skill: "Storytelling" },
    100: { name: "The Grand Star", goal: "Celebrate your 100-level journey!", user: "Winner", actor: "Saifur Sir", skill: "Track A Graduation" }
};

app.post('/api/chat', async (req, res) => {
    let { message, userId } = req.body;
    const isStart = message === "Action!";
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const currentLvl = Math.floor(user.lifetime_score / 1000) + 1;
        // Logic to handle 100 levels mapping
        let config = TRACK_A_CURRICULUM[currentLvl];
        if (!config) {
             // Fallback for levels not explicitly defined in the map (dynamic scaling)
             config = { name: `Step ${currentLvl}`, goal: "Practice simple English sentences.", user: "Learner", actor: "Mentor", skill: "Functional English" };
        }

        if (isStart) user.history = [];
        const context = user.history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

        // 🧠 KIDS' SPECIAL LOGIC PROMPT
        const masterPrompt = `
        [IDENTITY] World-class Kids' Mentor (Saifur Sir Style) & Practicing Muslim. 
        [TONE] Very encouraging, happy, and simple (6-10 years old level).
        [LANGUAGE] Speak ONLY simple English. No complex words.
        
        [LEVEL INFO]
        - Mission: ${config.name} | Goal: ${config.goal}
        - User Role: ${config.user} | Actor Role: ${config.actor}

        [INSTRUCTIONS]
        1. START: Greet with 'Assalamu Alaikum', tell the kid their goal in a fun way, and start the play.
        2. NO ECHO: Be a real character. Don't repeat the kid.
        3. SCORING: Give +10 XP if they try to speak in English and use the skill ${config.skill}.
        4. FEEDBACK: Keep the Mentor Tip very short and sweet (like a friendly teacher).

        [JSON OUTPUT]
        {
          "conversation": "Actor's fun reply",
          "learning_note": "• Well done! \\n• Tip: ${config.skill} insight... \\n• Next: Keep going!",
          "score_added": 10 or 0
        }
        
        History: ${context}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? "I am ready. Let's play!" : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.8, // More creative for kids
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 20000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        user.history.push({ role: 'User', content: isStart ? "Started" : message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 8) user.history = user.history.slice(-8);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        
        await user.save();

        res.json({ reply: result.conversation, instruction: result.learning_note, score_added: result.score_added, new_total_score: user.lifetime_score });

    } catch (err) { res.json({ reply: "Oh! Let's try again, little star!", instruction: "• Check connection.\\n• Try a short sentence." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
        else res.json({ score: 0, level: 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Kids Magic Mastery running on ${PORT}`));
