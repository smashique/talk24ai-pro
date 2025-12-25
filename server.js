<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Talk24AI | Mastery</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&family=Fredoka:wght@500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
    <style>
        :root { --bg: #002b20; --card: #001e17; --input: #00382e; --cyan: #00ffcc; --gray: #aabeb8; }
        body { font-family: 'Nunito', sans-serif; margin: 0; background: var(--bg); color: white; height: 100vh; overflow: hidden; }
        .screen { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; padding: 15px; z-index: 5000; }
        .active-screen { display: flex; }
        
        .top-nav { padding: 15px 20px; display: flex; align-items: center; width: 100%; max-width: 600px; gap: 12px; background: var(--bg); border-bottom: 1px solid #004d40; }
        .progress-track { flex: 1; height: 8px; background: #00382e; border-radius: 5px; }
        .progress-fill { height: 100%; background: var(--cyan); border-radius: 5px; transition: width 0.5s; box-shadow: 0 0 10px var(--cyan); }
        .badge { background: var(--input); border: 1.5px solid var(--cyan); padding: 5px 10px; border-radius: 8px; color: var(--cyan); font-weight: 900; font-size: 11px; }

        #messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 600px; padding-bottom: 120px; }
        .bubble { padding: 12px 16px; border-radius: 15px; font-size: 15px; max-width: 85%; }
        .ai-bubble { background: var(--input); align-self: flex-start; border: 1px solid #004d40; }
        .user-bubble { background: linear-gradient(135deg, #00b4db, #0083b0); align-self: flex-end; }
        
        /* Fixed Assessment Card */
        .assessment-card { margin-top: 10px; padding: 10px; border: 1.5px solid var(--cyan); border-radius: 10px; font-size: 11px; color: var(--cyan); font-weight: 800; background: rgba(0, 255, 204, 0.05); }
        .mentor-note { margin-top: 8px; font-size: 12px; color: var(--gray); border-left: 3px solid var(--cyan); padding-left: 10px; font-style: italic; background: rgba(0,0,0,0.1); border-radius: 5px; padding: 8px; }

        .choice-box { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .choice-btn { background: transparent; border: 1.5px solid var(--cyan); color: var(--cyan); padding: 8px 15px; border-radius: 20px; font-size: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; }

        .bottom-area { position: fixed; bottom: 0; width: 100%; padding: 15px; background: rgba(0, 30, 23, 0.95); display: flex; justify-content: center; backdrop-filter: blur(10px); }
        .input-deck { width: 100%; max-width: 600px; display: flex; gap: 10px; align-items: center; }
        
        /* Mic Button Fixed */
        #mic-btn { width: 45px; height: 45px; border-radius: 12px; background: var(--input); border: 1.5px solid var(--cyan); color: var(--cyan); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        #mic-btn.listening { background: #ff2e63; color: white; border-color: #ff2e63; animation: pulse 1s infinite; }
        
        .input-box { flex: 1; background: var(--input); border: 1px solid #004d40; border-radius: 12px; padding: 12px; color: white; outline: none; font-size: 15px; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,46,99,0.7); } 70% { box-shadow: 0 0 0 10px rgba(255,46,99,0); } }
    </style>
</head>
<body>

<audio id="snd-success" src="https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"></audio>

<div id="home-screen" class="screen active-screen">
    <div style="text-align:center;">
        <h1 style="color:var(--cyan); font-family:'Fredoka';">Talk24AI</h1>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; width:300px;">
            <button onclick="loadTopics('A')" style="padding:20px; border-radius:15px; background:var(--input); color:var(--cyan); border:none; cursor:pointer; font-weight:900;">Beginner</button>
            <button onclick="loadTopics('B')" style="padding:20px; border-radius:15px; background:var(--input); color:var(--cyan); border:none; cursor:pointer; font-weight:900;">Learner</button>
            <button onclick="loadTopics('C')" style="padding:20px; border-radius:15px; background:var(--input); color:var(--cyan); border:none; cursor:pointer; font-weight:900;">Hesitant</button>
            <button onclick="loadTopics('D')" style="padding:20px; border-radius:15px; background:var(--input); color:var(--cyan); border:none; cursor:pointer; font-weight:900;">Pro</button>
        </div>
    </div>
</div>

<div id="chat-screen" class="screen" style="padding:0;">
    <div class="top-nav">
        <div class="badge" id="chat-lvl">LVL 1</div>
        <div class="progress-track"><div class="progress-fill" id="xp-bar"></div></div>
        <button onclick="location.reload()" style="background:#444; border:none; padding:8px; border-radius:8px; color:white; font-size:10px; cursor:pointer;">EXIT</button>
    </div>
    <div id="messages"></div>
    <div class="bottom-area">
        <div class="input-deck">
            <button id="mic-btn" onclick="toggleMic()">🎙️</button>
            <input type="text" id="userInput" class="input-box" placeholder="Speak your mind..." onkeypress="if(event.key==='Enter')sendToAI(this.value)">
        </div>
    </div>
</div>

<script>
    const SERVER_URL = "https://talk24ai.onrender.com"; 
    let USER_ID = localStorage.getItem('talk24_uid') || 'ID-' + Math.floor(Math.random() * 900000);
    localStorage.setItem('talk24_uid', USER_ID);
    
    let state = { mod: null, score: parseInt(localStorage.getItem('talk24_score')) || 0 };

    window.onload = () => updateUI(state.score);

    function updateUI(s) {
        state.score = s;
        localStorage.setItem('talk24_score', s);
        const lvl = Math.floor(s/1000)+1;
        document.getElementById('chat-lvl').innerText = `LVL ${lvl}`;
        document.getElementById('xp-bar').style.width = `${(s % 1000 / 1000) * 100}%`;
    }

    function loadTopics(m) {
        state.mod = m;
        document.getElementById('home-screen').classList.remove('active-screen');
        document.getElementById('chat-screen').classList.add('active-screen');
        callAPI({ message: "Action!", systemInstruction: `Skill Level: ${state.mod}`, userId: USER_ID });
    }

    async function sendToAI(text) {
        if(!text.trim()) return;
        const d = document.createElement('div'); d.className = 'bubble user-bubble'; d.innerText = text;
        document.getElementById('messages').appendChild(d);
        document.getElementById('userInput').value = "";
        document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
        callAPI({ message: text, systemInstruction: `Skill Level: ${state.mod}`, userId: USER_ID });
    }

    async function callAPI(payload) {
        const mic = document.getElementById('mic-btn');
        mic.classList.add('listening');
        try {
            const res = await fetch(`${SERVER_URL}/api/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            const data = await res.json();
            mic.classList.remove('listening');
            if(data.score_added > 0) {
                confetti({ particleCount: 30, origin: { y: 0.8 } });
                updateUI(data.new_total_score);
            }
            renderAiMsg(data.reply, data.performance, data.notes);
        } catch(e) { mic.classList.remove('listening'); }
    }

    function renderAiMsg(reply, perf, notes) {
        const box = document.getElementById('messages');
        const d = document.createElement('div'); d.className = 'bubble ai-bubble';
        
        let cleanText = reply;
        let choices = [];
        const match = reply.match(/\[A\.(.*)\|.*B\.(.*)\]/);
        if(match) { cleanText = reply.split('[')[0]; choices = [match[1].trim(), match[2].trim()]; }

        // Logic to handle [object Object] issue
        let displayPerf = typeof perf === 'object' ? JSON.stringify(perf).replace(/[{}"]/g, '') : perf;

        d.innerHTML = `<div>${cleanText}</div>`;
        if(displayPerf) d.innerHTML += `<div class="assessment-card">📊 ASSESSMENT: ${displayPerf}</div>`;
        if(notes) d.innerHTML += `<div class="mentor-note">${notes.replace(/\\n/g, '<br>')}</div>`;
        
        if(choices.length > 0) {
            const cBox = document.createElement('div'); cBox.className = 'choice-box';
            choices.forEach(c => {
                const b = document.createElement('button'); b.className='choice-btn'; b.innerText=c;
                b.onclick=()=>sendToAI(c); cBox.appendChild(b);
            });
            d.appendChild(cBox);
        }
        box.appendChild(d); box.scrollTop = box.scrollHeight;
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(cleanText));
    }

    const rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = rec ? new rec() : null;
    function toggleMic() { 
        if(!recognition) return alert("Mic not supported."); 
        recognition.start(); 
        recognition.onresult=(e)=>sendToAI(e.results[0][0].transcript); 
    }
</script>
</body>
</html>
