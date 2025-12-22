<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Talk24AI | Level Up</title>
    <link rel="manifest" href="/manifest.json">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
    
    <style>
        /* --- 🎨 THEME: DEEP ISLAMIC GREEN & GOLD --- */
        :root { 
            --bg-deep: #022c22; 
            --bg-grad: linear-gradient(135deg, #065f46 0%, #047857 100%);
            --gold: #fbbf24; 
            --gold-shadow: #d97706;
            --white: #ffffff;
            --text-dark: #1f2937;
            --font: 'Nunito', sans-serif;
        }

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { font-family: var(--font); margin: 0; background: var(--bg-grad); display: flex; flex-direction: column; height: 100vh; overflow: hidden; color: var(--text-dark); user-select: none; }

        /* --- 🌀 BACKGROUND --- */
        .bg-shape { position: absolute; border-radius: 50%; opacity: 0.1; z-index: -1; animation: float 30s infinite linear; filter: blur(60px); }
        .shape1 { width: 300px; height: 300px; background: #6ee7b7; top: -10%; left: -10%; }
        .shape2 { width: 200px; height: 200px; background: #34d399; bottom: -10%; right: -10%; }
        @keyframes float { 0% { transform: translate(0, 0); } 50% { transform: translate(20px, 40px); } 100% { transform: translate(0, 0); } }

        /* --- 🏠 HOME SCREEN (NO SCROLL) --- */
        #home-screen { position: fixed; inset: 0; z-index: 5000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 15px; }
        
        .logo { font-family: 'Fredoka', sans-serif; font-size: 38px; color: var(--white); margin-bottom: 5px; text-shadow: 0 4px 10px rgba(0,0,0,0.3); letter-spacing: -1px; }
        
        /* COMPACT STATS */
        .home-stats { display: flex; gap: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.25); padding: 5px 12px; border-radius: 15px; color: #a7f3d0; font-weight: 800; font-size: 12px; border: 1px solid rgba(255,255,255,0.1); }

        /* HERO CARD (COMPACT) */
        .hero-card { width: 100%; max-width: 450px; background: rgba(255, 255, 255, 0.96); border-radius: 25px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 15px; max-height: 85vh; }
        
        /* HOOK SECTION */
        .hook-box { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 15px; }
        .pain-point { font-size: 14px; color: #dc2626; font-weight: 800; line-height: 1.3; margin-bottom: 4px; }
        .achievement-hook { font-size: 13px; color: #059669; font-weight: 700; }
        .relief-msg { font-size: 11px; color: #6b7280; font-style: italic; margin-top: 4px; }

        /* GRID LAYOUT FOR SKILLS (DUOLINGO STYLE) */
        .skill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; overflow-y: auto; padding: 2px; }
        .skill-option { background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 16px; padding: 10px; cursor: pointer; transition: 0.1s; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 85px; }
        .skill-option:active { transform: scale(0.96); }
        .skill-option.selected { background: #ecfdf5; border-color: #10b981; box-shadow: 0 4px 0 #047857; transform: translateY(-2px); }
        
        /* FULL WIDTH FOR LAST ITEM */
        .skill-option:last-child { grid-column: span 2; flex-direction: row; gap: 10px; height: 60px; }
        
        .skill-icon { font-size: 24px; margin-bottom: 4px; }
        .skill-option:last-child .skill-icon { margin-bottom: 0; }
        .skill-head { font-weight: 800; font-size: 13px; color: #374151; }
        .skill-sub { font-size: 10px; color: #9ca3af; font-weight: 600; line-height: 1; }

        /* ACTION BUTTONS */
        .btn-group { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
        .btn-start { width: 100%; padding: 14px; background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%); color: #78350f; font-size: 18px; font-weight: 900; border: none; border-radius: 18px; box-shadow: 0 5px 0 #d97706; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; position: relative; overflow: hidden; }
        .btn-start::after { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shine 3s infinite; }
        .btn-start:active { transform: translateY(4px); box-shadow: none; }

        #install-btn { width: 100%; background: transparent; color: #065f46; border: 2px solid #e5e7eb; padding: 10px; border-radius: 15px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
        #install-btn:active { background: #f3f4f6; }

        /* --- 💬 CHAT SCREEN --- */
        #chat-screen { display: none; flex-direction: column; height: 100%; max-width: 600px; margin: 0 auto; background: #f9fafb; }
        .top-nav { padding: 8px 15px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 10px; height: 60px; }
        .level-badge { background: #064e3b; color: #fff; padding: 4px 10px; border-radius: 10px; font-weight: 800; font-size: 11px; }
        .progress-container { flex: 1; } .progress-track { height: 8px; background: #e5e7eb; border-radius: 5px; overflow: hidden; } .progress-fill { height: 100%; background: #10b981; width: 0%; transition: width 0.5s; }
        
        #messages { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; padding-bottom: 100px; }
        .bubble { padding: 12px 16px; border-radius: 16px; font-size: 15px; font-weight: 600; width: fit-content; max-width: 85%; line-height: 1.4; }
        .ai-bubble { background: #fff; border: 1px solid #e5e7eb; color: #1f2937; border-bottom-left-radius: 4px; }
        .user-bubble { background: #059669; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .mentor-note { margin-top: 5px; background: #ecfdf5; padding: 10px; border-radius: 10px; font-size: 13px; border-left: 3px solid #059669; color: #064e3b; font-weight: 700; }

        .bottom-area { position: fixed; bottom: 0; left: 0; width: 100%; padding: 10px; display: flex; justify-content: center; background: rgba(255,255,255,0.8); backdrop-filter: blur(5px); }
        .input-deck { width: 100%; max-width: 600px; display: flex; gap: 10px; }
        #mic-btn { width: 45px; height: 45px; border-radius: 50%; background: #064e3b; color: white; border: none; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 0 #022c22; }
        #mic-btn.listening { background: #ef4444; animation: pulse 1s infinite; }
        .input-box { flex: 1; border: 2px solid #e5e7eb; border-radius: 20px; padding: 0 15px; font-size: 16px; outline: none; }

        /* MODAL */
        #level-up-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 7000; align-items: center; justify-content: center; }
        .levelup-card { background: white; padding: 30px; border-radius: 25px; text-align: center; border: 4px solid #fbbf24; animation: popIn 0.4s; }
        
        @keyframes shine { 100% { left: 100%; } }
        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
    </style>
</head>
<body>

<audio id="snd-click" src="https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"></audio>
<audio id="snd-success" src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"></audio>
<audio id="snd-levelup" src="https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3"></audio>

<div class="bg-shape shape1"></div><div class="bg-shape shape2"></div>

<div id="level-up-modal">
    <div class="levelup-card">
        <div style="font-size:50px;">🏆</div>
        <h2 style="color:#d97706; margin:10px 0; font-weight:900;">LEVEL UP!</h2>
        <p>Now Level <span id="new-level-display" style="color:#064e3b; font-weight:bold;">2</span></p>
        <button class="btn-start" style="font-size:14px; padding:10px;" onclick="closeLevelModal()">Continue</button>
    </div>
</div>

<div id="home-screen">
    <div class="logo">Talk24AI</div>
    <div class="home-stats">⭐ Lvl <span id="home-lvl">1</span> • ⚡ <span id="home-score">0</span> XP</div>

    <div class="hero-card">
        <div class="hook-box">
            <div class="pain-point">😰 ইংরেজিতে কথা বলতে গিয়ে আটকে যাচ্ছেন?</div>
            <div class="achievement-hook">🚀 জড়তা কাটান, ক্যারিয়ার গড়ুন!</div>
            <div class="relief-msg">"Alhamdulillah, finally a judgment-free partner!"</div>
        </div>

        <div style="font-size:12px; font-weight:800; color:#6b7280; margin-bottom:5px;">SELECT LEVEL</div>

        <div class="skill-grid">
            <div class="skill-option" onclick="selectSkill('A', this)">
                <div class="skill-icon">🐣</div>
                <div class="skill-head">Beginner</div>
                <div class="skill-sub">Zero to Hero</div>
            </div>
            <div class="skill-option" onclick="selectSkill('B', this)">
                <div class="skill-icon">📚</div>
                <div class="skill-head">Learner</div>
                <div class="skill-sub">Basic Grammar</div>
            </div>
            <div class="skill-option" onclick="selectSkill('C', this)">
                <div class="skill-icon">🗣️</div>
                <div class="skill-head">Hesitant</div>
                <div class="skill-sub">Shy Speaker</div>
            </div>
            <div class="skill-option" onclick="selectSkill('D', this)">
                <div class="skill-icon">✈️</div>
                <div class="skill-head">IELTS/GRE</div>
                <div class="skill-sub">High Band</div>
            </div>
            <div class="skill-option" onclick="selectSkill('E', this)">
                <div class="skill-icon">💼</div>
                <div>
                    <div class="skill-head">Professional</div>
                    <div class="skill-sub">Corporate & Business</div>
                </div>
            </div>
        </div>

        <div class="btn-group">
            <button class="btn-start" onclick="startSession()">Start Mission 🚀</button>
            <button id="install-btn" onclick="installApp()">📲 Install App</button>
        </div>
    </div>
</div>

<div id="chat-screen">
    <div class="top-nav">
        <div class="level-badge" id="chat-lvl-badge">LVL 1</div>
        <div class="progress-container">
            <div class="progress-track"><div class="progress-fill" id="xp-bar"></div></div>
        </div>
    </div>
    <div id="messages"></div>
    <div class="bottom-area">
        <div class="input-deck">
            <button id="mic-btn" onclick="toggleMic()">🎤</button>
            <input type="text" id="userInput" class="input-box" placeholder="Type or Speak..." onkeypress="handleEnter(event)">
        </div>
    </div>
</div>

<script>
    const SERVER_URL = "https://talk24ai.onrender.com"; 
    let USER_ID = localStorage.getItem('talk24_uid');
    if (!USER_ID) { USER_ID = 'ID-' + Math.floor(100000 + Math.random() * 900000); localStorage.setItem('talk24_uid', USER_ID); }
    let state = { skill: null, level: 1, score: 0 };
    const play = (id) => { const a = document.getElementById(id); if(a){ a.currentTime=0; a.play().catch(()=>{}); } };

    window.onload = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/stats`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId: USER_ID}) });
            const data = await res.json();
            updateStatsUI(data.score, data.level);
        } catch(e) {}
    };

    function updateStatsUI(score, level) {
        state.score = score; state.level = level;
        document.getElementById('home-score').innerText = score;
        document.getElementById('home-lvl').innerText = level;
        document.getElementById('chat-lvl-badge').innerText = `LVL ${level}`;
        document.getElementById('xp-bar').style.width = `${(score % 1000 / 1000) * 100}%`;
    }

    function selectSkill(code, el) {
        play('snd-click');
        document.querySelectorAll('.skill-option').forEach(d => d.classList.remove('selected'));
        el.classList.add('selected');
        state.skill = code;
    }

    function startSession() {
        if (!state.skill) return alert("Select a Level!");
        play('snd-click');
        document.getElementById('home-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        callAPI({ message: "Action!", systemInstruction: `Skill Level: ${state.skill}`, userId: USER_ID });
    }

    async function sendToAI(text) {
        if (!text.trim()) return;
        if (/[অ-ঔক-হ]/.test(text)) { alert("Only English allowed!"); return; }
        play('snd-click');
        addUserMsg(text);
        document.getElementById('userInput').value = '';
        callAPI({ message: text, systemInstruction: "Check grammar", userId: USER_ID });
    }

    async function callAPI(payload) {
        try {
            document.getElementById('mic-btn').classList.add('listening');
            const res = await fetch(`${SERVER_URL}/api/chat`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            const data = await res.json();
            document.getElementById('mic-btn').classList.remove('listening');
            if (data.score_added > 0) {
                play('snd-success');
                confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
                const newLvl = Math.floor(data.new_total_score / 1000) + 1;
                if (newLvl > state.level) showLevelUp(newLvl);
                updateStatsUI(data.new_total_score, newLvl);
            }
            addAiMsg(data.reply, data.instruction);
        } catch (e) { document.getElementById('mic-btn').classList.remove('listening'); }
    }

    function addUserMsg(text) {
        const d = document.createElement('div'); d.innerHTML = `<div class="bubble user-bubble">${text}</div>`;
        d.style.display='flex'; d.style.justifyContent='flex-end';
        document.getElementById('messages').appendChild(d);
        scrollToBottom();
    }

    function addAiMsg(text, note) {
        const d = document.createElement('div');
        let html = `<div class="bubble ai-bubble">${text}</div>`;
        if (note) html += `<div class="mentor-note">${note}</div>`;
        d.innerHTML = html;
        document.getElementById('messages').appendChild(d);
        scrollToBottom();
        const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; window.speechSynthesis.speak(u);
    }

    function showLevelUp(lvl) {
        play('snd-levelup');
        document.getElementById('new-level-display').innerText = lvl;
        document.getElementById('level-up-modal').style.display = 'flex';
        confetti({ particleCount: 100, spread: 90, origin: { y: 0.6 } });
    }
    
    function closeLevelModal() { document.getElementById('level-up-modal').style.display = 'none'; }
    function scrollToBottom() { const b = document.getElementById('messages'); b.scrollTop = b.scrollHeight; }
    function handleEnter(e) { if(e.key === 'Enter') sendToAI(e.target.value); }

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
    async function installApp() { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } else alert("Check browser menu to install."); }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = SpeechRecognition ? new SpeechRecognition() : null;
    function toggleMic() {
        if (!recognition) return alert("Use Chrome for voice.");
        recognition.lang = 'en-US';
        recognition.start();
        recognition.onresult = (e) => {
            const txt = e.results[0][0].transcript;
            document.getElementById('userInput').value = txt;
            sendToAI(txt);
        };
    }
</script>
</body>
</html>
