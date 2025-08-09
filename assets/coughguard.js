// coughguard.js (improved) – Patient‑friendly cough recorder for plain HTML sites
// Drop this file in /assets and link it with: <script src="assets/coughguard.js"></script>
// Requirements: Serve over HTTPS (or localhost). Modern Chrome/Edge/Safari (iOS 14.3+).

(function(){
  const host = document.getElementById('cough-guard');
  if(!host) return;

  // --- UI -------------------------------------------------------------------
  host.innerHTML = `
    <style>
      .cg-wrap{max-width:760px;margin:40px auto;padding:0 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}
      .cg-card{border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04);padding:16px;margin-top:12px}
      .cg-h1{font-size:24px;font-weight:700;margin:0 0 4px}
      .cg-sub{color:#6b7280;margin:0 0 12px}
      .cg-row{display:flex;gap:8px;flex-wrap:wrap}
      .cg-btn{appearance:none;border:0;border-radius:12px;padding:12px 16px;font-weight:700;cursor:pointer}
      .cg-btn.start{background:#16a34a;color:#fff}
      .cg-btn.stop{background:#dc2626;color:#fff}
      .cg-btn.mic{background:#2563eb;color:#fff}
      .cg-btn:disabled{opacity:.5;cursor:not-allowed}
      .cg-wave{height:110px;background:#f3f4f6;border-radius:12px}
      .cg-label{font-size:14px;color:#374151;margin:8px 0 4px;display:block}
      .cg-input, .cg-text{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
      .cg-text{min-height:80px}
      .cg-msg{margin-top:10px;font-size:14px}
      .cg-msg.ok{color:#065f46}
      .cg-msg.err{color:#b91c1c}
      .cg-audio{width:100%;margin-top:10px}
      .cg-footer{font-size:12px;color:#6b7280;margin-top:12px}
      @media (max-width:480px){.cg-row{flex-direction:column}}
    </style>
    <div class="cg-wrap">
      <h2 class="cg-h1">Cough Guard</h2>
      <p class="cg-sub">A simple, private way to record cough sounds and share them with your physio.</p>

      <div class="cg-card">
        <div class="cg-row">
          <button id="cg-mic" class="cg-btn mic">Enable Microphone</button>
          <button id="cg-start" class="cg-btn start" disabled>● Start Recording</button>
          <button id="cg-stop" class="cg-btn stop" disabled>■ Stop Recording</button>
        </div>
        <canvas id="cg-wave" class="cg-wave"></canvas>
        <audio id="cg-audio" class="cg-audio" controls style="display:none"></audio>
        <div id="cg-msg" class="cg-msg"></div>
      </div>

      <div class="cg-card">
        <label class="cg-label" for="cg-days">Days unwell</label>
        <input id="cg-days" class="cg-input" type="number" min="0" step="1" inputmode="numeric" placeholder="e.g., 3" />

        <label class="cg-label" for="cg-notes">Notes (optional)</label>
        <textarea id="cg-notes" class="cg-text" placeholder="Anything else you want your physio to know…"></textarea>

        <label class="cg-label" for="cg-photo">Upload photo (optional)</label>
        <input id="cg-photo" type="file" accept="image/*" capture="environment" />
      </div>

      <div class="cg-footer">Privacy: Your audio stays in your browser unless you choose to download or share it.</div>
    </div>
  `;

  // --- Recording logic ------------------------------------------------------
  const els = {
    mic: host.querySelector('#cg-mic'),
    start: host.querySelector('#cg-start'),
    stop: host.querySelector('#cg-stop'),
    audio: host.querySelector('#cg-audio'),
    wave: host.querySelector('#cg-wave'),
    msg: host.querySelector('#cg-msg'),
    days: host.querySelector('#cg-days')
  };

  let stream = null, recorder = null, chunks = [], recStart = 0;

  // Prevent negative days
  els.days.addEventListener('input', () => {
    const v = parseInt(els.days.value || '');
    if (isNaN(v) || v < 0) els.days.value = '';
  });

  function setMsg(text, ok){
    els.msg.textContent = text || '';
    els.msg.className = 'cg-msg ' + (ok===true ? 'ok' : ok===false ? 'err' : '');
  }

  function preferredMime(){
    const types = [
      'audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'
    ];
    for(const t of types){ if(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t; }
    return 'audio/webm';
  }

  // Waveform visualiser (lightweight)
  let audioCtx, analyser, anim;
  function startWave(){
    if(!stream) return;
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    audioCtx = new AC();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const cvs = els.wave, ctx = cvs.getContext('2d');
    const data = new Uint8Array(analyser.fftSize);
    function draw(){
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0,0,cvs.width,cvs.height);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111827'; ctx.beginPath();
      const step = cvs.width / data.length; let x = 0;
      for(let i=0;i<data.length;i++){ const y = (data[i]/128.0)*cvs.height/2; i?ctx.lineTo(x,y):ctx.moveTo(x,y); x+=step; }
      ctx.lineTo(cvs.width,cvs.height/2); ctx.stroke();
      anim = requestAnimationFrame(draw);
    }
    cvs.width = cvs.clientWidth * (window.devicePixelRatio||1);
    cvs.height = cvs.clientHeight * (window.devicePixelRatio||1);
    draw();
  }
  function stopWave(){ if(anim) cancelAnimationFrame(anim); try{audioCtx && audioCtx.close();}catch(e){} }

  // Enable microphone
  els.mic.addEventListener('click', async () => {
    try{
      if(!navigator.mediaDevices?.getUserMedia){
        setMsg('Recording is not supported in this browser. Please try the latest Chrome, Edge, or Safari.', false);return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true } });
      els.start.disabled = false; els.mic.disabled = true;
      setMsg('Microphone enabled. Tap Start to record.', true);
      startWave();
    }catch(err){
      setMsg('Microphone was blocked. Please allow mic access and reload the page.', false);
    }
  });

  // Start recording
  els.start.addEventListener('click', () => {
    if(!stream){ setMsg('Enable the microphone first.', false); return; }
    try{
      chunks = [];
      recorder = new MediaRecorder(stream, { mimeType: preferredMime() });
      recorder.ondataavailable = e => { if(e.data && e.data.size>0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        els.audio.src = url; els.audio.style.display = 'block';
        setMsg('Recording saved. You can play it back below.', true);
      };
      recorder.start(); recStart = Date.now();
      els.start.disabled = true; els.stop.disabled = false;
      setMsg('Recording… cough once or twice, then press Stop.', true);
    }catch(err){ setMsg('Could not start recording. Try another browser.', false); }
  });

  // Stop recording
  els.stop.addEventListener('click', () => {
    if(recorder && recorder.state !== 'inactive') recorder.stop();
    els.stop.disabled = true; els.start.disabled = false;
    setMsg('Processing recording…', true);
  });

  // Cleanup if page is hidden/unloaded
  window.addEventListener('pagehide', () => { try{stream?.getTracks().forEach(t=>t.stop());}catch(e){} stopWave(); });
})();
