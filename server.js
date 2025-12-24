const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🌍 OPTIMIZED PERSISTENT DB
mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 })
.then(() => console.log("🚀 Persistent Academy DB Connected!"))
.catch(err => console.error("❌ DB Connection Error:", err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lifetime_score: { type: Number, default: 0 },
    history: [{ role: String, content: String }]
});
const User = mongoose.model('User', userSchema);

// 📘 TRACK A: PRE-DETERMINED LEVELS (1-75)
const TRACK_A_CURRICULUM = {
    // Phase 1 (1-25)
    1: { name: "The First Hello", goal: "Master greetings like Salam, Hi, and Hello.", user: "New Neighbor", actor: "Friendly Resident", skill: "Greetings" },
    2: { name: "Meet My Family", goal: "Name your family members (Father, Mother, Brother).", user: "Photo Sharer", actor: "Curious Friend", skill: "Family Nouns" },
    3: { name: "Bag Check", goal: "Identify items like Phone, Pen, and Keys.", user: "Traveler", actor: "Security Guard", skill: "Object Nouns" },
    4: { name: "Yummy Fruits", goal: "Identify and name common fruits correctly.", user: "Customer", actor: "Fruit Seller", skill: "Food Nouns" },
    5: { name: "Colorful World", goal: "Describe objects using basic color names.", user: "Art Student", actor: "Art Teacher", skill: "Colors" },
    6: { name: "My Cozy Room", goal: "Name furniture like Chair, Table, and Bed.", user: "Guest", actor: "Host", skill: "Furniture Nouns" },
    7: { name: "Pet Paradise", goal: "Name animals like Cat, Dog, and Bird.", user: "Kid", actor: "Pet Shop Owner", skill: "Animal Nouns" },
    8: { name: "Body Map", goal: "Name basic body parts like Hand, Eye, and Nose.", user: "Patient", actor: "Nurse", skill: "Body Nouns" },
    9: { name: "Dress Up", goal: "Name clothing items like Shirt, Pant, and Shoes.", user: "Shopper", actor: "Sales Assistant", skill: "Clothing Nouns" },
    10: { name: "Number Fun", goal: "Use numbers 1 to 10 in a conversation.", user: "Small Buyer", actor: "Shopkeeper", skill: "Numbers" },
    11: { name: "My Study Table", goal: "Name stationery like Pen, Pencil, and Notebook.", user: "Student", actor: "Teacher", skill: "Stationery Nouns" },
    12: { name: "Nature's Map", goal: "Identify Sun, Moon, Sky, and Cloud.", user: "Grandchild", actor: "Grandpa", skill: "Nature Nouns" },
    13: { name: "Weather Watch", goal: "Use nouns like Rain, Wind, and Heat.", user: "Radio Host", actor: "Listener", skill: "Weather Nouns" },
    14: { name: "The Safe City", goal: "Name Mosque, Hospital, and School correctly.", user: "Tourist", actor: "Local Guide", skill: "Place Nouns" },
    15: { name: "Vehicle Parade", goal: "Name Bus, Train, Rickshaw, and Boat.", user: "Passenger", actor: "Driver", skill: "Vehicle Nouns" },
    16: { name: "Healthy Veggies", goal: "Identify Potato, Tomato, and Onion.", user: "Chef", actor: "Kitchen Helper", skill: "Vegetable Nouns" },
    17: { name: "Morning Snacks", goal: "Name Milk, Egg, Bread, and Biscuit.", user: "Hungry Kid", actor: "Mother", skill: "Food Nouns" },
    18: { name: "The Clock Nouns", goal: "Use Morning, Evening, Hour, and Minute.", user: "Traveler", actor: "Station Guard", skill: "Time Nouns" },
    19: { name: "The Planner", goal: "Name Days of the week and Months correctly.", user: "Planner", actor: "Colleague", skill: "Calendar Nouns" },
    20: { name: "Season Cycle", goal: "Name Summer, Winter, and Rain seasons.", user: "Kid", actor: "Wise Uncle", skill: "Seasons" },
    21: { name: "Living Room", goal: "Identify Sofa, TV, Mirror, and Fan.", user: "Guest", actor: "Host", skill: "Furniture Nouns" },
    22: { name: "Tech World", goal: "Name Laptop, Mobile, and AC.", user: "Customer", actor: "IT Staff", skill: "Technology Nouns" },
    23: { name: "Stationery Fun", goal: "Identify Glue, Scissors, and Paper.", user: "Small Artist", actor: "Shopkeeper", skill: "Art Nouns" },
    24: { name: "Green Garden", goal: "Name Tree, Flower, Leaf, and Grass.", user: "Nature Lover", actor: "Gardener", skill: "Nature Nouns" },
    25: { name: "Shopping Hero", goal: "Use nouns like Lift, Trolley, and Counter.", user: "Shopper", actor: "Floor Manager", skill: "Supermarket Nouns" },
    
    // Phase 2 (26-50)
    26: { name: "Park Fun", goal: "Name objects like Slide, Swing, and Bench.", user: "Playful Child", actor: "Parent", skill: "Park Nouns" },
    27: { name: "Hospital Visit", goal: "Use nouns like Nurse, Medicine, and Doctor.", user: "Patient", actor: "Medical Assistant", skill: "Medical Nouns" },
    28: { name: "Bank Matters", goal: "Identify Cash, Counter, and Form.", user: "Client", actor: "Bank Teller", skill: "Bank Nouns" },
    29: { name: "Post Office", goal: "Name Stamp, Letter, and Envelope.", user: "Sender", actor: "Postmaster", skill: "Postal Nouns" },
    30: { name: "Classroom Tools", goal: "Identify Board, Duster, and Chalk.", user: "New Student", actor: "Class Teacher", skill: "Classroom Nouns" },
    31: { name: "Bakery Shop", goal: "Name Cake, Bread, and Biscuit.", user: "Sweet Lover", actor: "Baker", skill: "Bakery Nouns" },
    32: { name: "Toy Store", goal: "Name Doll, Car, and Teddy Bear.", user: "Gift Buyer", actor: "Shop Assistant", skill: "Toy Nouns" },
    33: { name: "Hardware Store", goal: "Identify Hammer, Nail, and Tool.", user: "Handyman", actor: "Store Keeper", skill: "Tool Nouns" },
    34: { name: "Electronics Shop", goal: "Name Laptop, Mouse, and Monitor.", user: "Tech Buyer", actor: "Sales Executive", skill: "Digital Nouns" },
    35: { name: "Hair Salon", goal: "Use nouns like Mirror, Scissors, and Comb.", user: "Customer", actor: "Barber", skill: "Salon Nouns" },
    36: { name: "Gym Items", goal: "Identify Mat, Dumbbell, and Bottle.", user: "Fitness Learner", actor: "Gym Trainer", skill: "Gym Nouns" },
    37: { name: "Library", goal: "Name Book, Shelf, and Card.", user: "Reader", actor: "Librarian", skill: "Library Nouns" },
    38: { name: "Beach Day", goal: "Identify Sand, Sea, and Umbrella.", user: "Tourist", actor: "Beach Guard", skill: "Beach Nouns" },
    39: { name: "Forest Trip", goal: "Name Tree, Path, and Bird.", user: "Hiker", actor: "Forest Guide", skill: "Wilderness Nouns" },
    40: { name: "Sky View", goal: "Identify Star, Cloud, and Rainbow.", user: "Sky Watcher", actor: "Astronomy Fan", skill: "Sky Nouns" },
    41: { name: "Road Safety", goal: "Name Signal, Zebra Crossing, and Sign.", user: "Pedestrian", actor: "Traffic Police", skill: "Safety Nouns" },
    42: { name: "Railway Station", goal: "Identify Platform, Ticket, and Train.", user: "Traveler", actor: "Ticket Master", skill: "Railway Nouns" },
    43: { name: "Airport Items", goal: "Name Plane, Gate, and Luggage.", user: "Flyer", actor: "Check-in Staff", skill: "Airport Nouns" },
    44: { name: "Hotel Stay", goal: "Identify Room, Key, and Lobby.", user: "Guest", actor: "Receptionist", skill: "Hotel Nouns" },
    45: { name: "Coffee Shop", goal: "Name Cup, Menu, and Sugar.", user: "Customer", actor: "Barista", skill: "Cafe Nouns" },
    46: { name: "Laundry", goal: "Identify Soap, Water, and Cloth.", user: "Customer", actor: "Laundry Staff", skill: "Laundry Nouns" },
    47: { name: "Repair Shop", goal: "Name Wrench, Screw, and Driver.", user: "Customer", actor: "Mechanic", skill: "Repair Nouns" },
    48: { name: "Playground", goal: "Identify Ball, Net, and Whistle.", user: "Player", actor: "Coach", skill: "Sports Nouns" },
    49: { name: "Music Class", goal: "Name Piano, Guitar, and Mic.", user: "Learner", actor: "Music Teacher", skill: "Music Nouns" },
    50: { name: "Mid-Term Review", goal: "Review all environment nouns learned so far.", user: "Successful Student", actor: "Global Mentor", skill: "General Nouns" },

    // Phase 3 (51-75)
    51: { name: "Shopping Mall", goal: "Identify Escalator, Boutique, and Receipt.", user: "Shopper", actor: "Security Guard", skill: "Mall Nouns" },
    52: { name: "Cinema Hall", goal: "Name Screen, Ticket, and Popcorn.", user: "Movie Fan", actor: "Ticket Counter", skill: "Cinema Nouns" },
    53: { name: "Pharmacy", goal: "Identify Prescription, Bandage, and Syrup.", user: "Buyer", actor: "Pharmacist", skill: "Medical Nouns" },
    54: { name: "Police Station", goal: "Name Complaint, Officer, and Cell.", user: "Reporter", actor: "Duty Officer", skill: "Legal Nouns" },
    55: { name: "Fire Station", goal: "Identify Truck, Hose, and Fireman.", user: "School Kid", actor: "Fire Fighter", skill: "Emergency Nouns" },
    56: { name: "Sweet Shop", goal: "Name Pastry, Oven, and Flour.", user: "Customer", actor: "Baker", skill: "Bakery Nouns" },
    57: { name: "Tailor Shop", goal: "Identify Thread, Needle, and Measurement.", user: "Customer", actor: "Tailor", skill: "Stitching Nouns" },
    58: { name: "Barber Shop 2", goal: "Name Shampoo, Chair, and Razor.", user: "Client", actor: "Barber", skill: "Grooming Nouns" },
    59: { name: "Elite Gym", goal: "Identify Treadmill, Coach, and Dumbbell.", user: "Member", actor: "Trainer", skill: "Fitness Nouns" },
    60: { name: "Old Library", goal: "Name Section, Encyclopedia, and Shelf.", user: "Researcher", actor: "Librarian", skill: "Study Nouns" },
    61: { name: "History Museum", goal: "Identify Statue, Artifact, and Guide.", user: "Tourist", actor: "Curator", skill: "Museum Nouns" },
    62: { name: "Art Gallery", goal: "Name Painting, Brush, and Artist.", user: "Art Critic", actor: "Exhibitor", skill: "Art Nouns" },
    63: { name: "Concert Stage", goal: "Identify Stage, Mic, and Instrument.", user: "Music Fan", actor: "Stage Manager", skill: "Event Nouns" },
    64: { name: "Soccer Stadium", goal: "Name Goal, Whistle, and Jersey.", user: "Striker", actor: "Referee", skill: "Sports Nouns" },
    65: { name: "Swimming Pool", goal: "Identify Goggles, Life-jacket, and Lane.", user: "Learner", actor: "Lifeguard", skill: "Water Nouns" },
    66: { name: "Airport Gate", goal: "Identify Passport, Visa, and Boarding Pass.", user: "Passenger", actor: "Gate Agent", skill: "Travel Nouns" },
    67: { name: "Train Coach", goal: "Name Platform, Coach, and Berth.", user: "Traveler", actor: "Ticket TTE", skill: "Railway Nouns" },
    68: { name: "Bus Terminal", goal: "Identify Route, Schedule, and Driver.", user: "Passenger", actor: "Counter Clerk", skill: "Transit Nouns" },
    69: { name: "Luxury Hotel", goal: "Name Room Service, Menu, and Elevator.", user: "Guest", actor: "Concierge", skill: "Hotel Nouns" },
    70: { name: "Bank ATM", goal: "Identify Check, ATM, and Balance.", user: "Client", actor: "Security", skill: "Financial Nouns" },
    71: { name: "Corporate Meeting", goal: "Name Meeting, File, and Laptop.", user: "Intern", actor: "Senior Manager", skill: "Office Nouns" },
    72: { name: "Principal Office", goal: "Identify Principal, Bench, and Blackboard.", user: "Parent", actor: "Admin Staff", skill: "School Nouns" },
    73: { name: "Holy Mosque", goal: "Name Prayer, Imam, and Peace.", user: "Worshiper", actor: "Friend", skill: "Spiritual Nouns" },
    74: { name: "City Fountain", goal: "Identify Fountain, Flowers, and Jogger.", user: "Visitor", actor: "Park Keeper", skill: "Urban Nouns" },
    75: { name: "Phase 3 Graduation", goal: "Final review of complex environment nouns.", user: "Top Graduate", actor: "Global Mentor", skill: "Advanced Nouns" }
};

app.post('/api/chat', async (req, res) => {
    let { message, userId } = req.body;
    const isStart = message === "Action!";
    
    try {
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        const currentLvl = Math.floor(user.lifetime_score / 1000) + 1;
        const config = TRACK_A_CURRICULUM[currentLvl] || TRACK_A_CURRICULUM[1];

        if (isStart) user.history = [];

        const context = user.history.slice(-4).map(h => `${h.role}: ${h.content}`).join("\n");

        const masterPrompt = `
        [IDENTITY] World-class English Mentor (Saifur Sir Style) & Practicing Muslim. 
        [ALL ENGLISH] Speak ONLY English. No other language.
        
        [LEVEL ${currentLvl} INFO]
        - Mission: ${config.name}
        - Focus Skill: ${config.skill}
        - Achievement Goal: ${config.goal}
        - User Role: ${config.user} | Actor Role: ${config.actor}

        [RULES]
        1. STARTUP: Mentor greets, states the level goal, and explains roles clearly.
        2. NO ECHO: Actor MUST NOT repeat user words and must move the plot.
        3. SCORING: Give +10 XP ONLY if the user correctly uses "${config.skill}" in context.
        4. MENTOR: Use Saifur Sir's shortcuts in the Tip. Maintain Islamic Akhlaq.

        [JSON OUTPUT]
        {
          "conversation": "Actor's natural reply",
          "learning_note": "• Review: ...\\n• Tip: ...\\n• Next Step: ...",
          "score_added": 10 or 0
        }
        
        History: ${context}`;

        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            messages: [{ role: "system", content: masterPrompt }, { role: "user", content: isStart ? "I am ready. Introduce the level and start." : message }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            response_format: { type: "json_object" }
        }, { headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}` }, timeout: 20000 });

        const result = JSON.parse(response.data.choices[0].message.content);

        user.history.push({ role: 'User', content: isStart ? "Started Session" : message });
        user.history.push({ role: 'Actor', content: result.conversation });
        if (user.history.length > 8) user.history = user.history.slice(-8);
        if (!isStart && result.score_added > 0) user.lifetime_score += result.score_added;
        
        await user.save();

        res.json({ reply: result.conversation, instruction: result.learning_note, score_added: result.score_added, new_total_score: user.lifetime_score });

    } catch (err) { res.json({ reply: "Connection slow. Repeat please?", instruction: "• Review: Timeout.\\n• Tip: Short sentences help.\\n• Next: Try again." }); }
});

app.post('/api/stats', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });
        if (user) res.json({ score: user.lifetime_score, level: Math.floor(user.lifetime_score/1000)+1 });
        else res.json({ score: 0, level: 1 });
    } catch(e) { res.json({ score: 0, level: 1 }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Track A Mastery Engine (Levels 1-75) running on ${PORT}`));
