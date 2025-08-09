// coughguard.js (triage + consent + AI-ready send) – Patient‑friendly cough recorder for plain HTML sites
// Place in /assets and link with: <script src="assets/coughguard.js"></script>
// Requirements: HTTPS (or localhost). Modern Chrome/Edge/Safari (iOS 14.3+).
// Optional A: Netlify Form "coughguard" (hidden) for simple inbox submissions.
// Optional B: Set API_URL below to post to your AI service which can score, generate a PDF, and email the patient.

(function(){
  const API_URL = null; // <- set to your backend endpoint later, e.g. "https://api.breathewell.ai/coughguard"

  const host = document.getElementById('cough-guard');
  if(!host) return;

  // --- UI -------------------------------------------------------------------
  host.innerHTML = `
    <style>
      .cg-wrap{max-width:860px;margin:40px auto;padding:0 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}
      .cg-card{border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04);padding:16px;margin-top:12px}
      .cg-h1{font-size:26px;font-weight:800;margin:0}
      .cg-sub{color:#6b7280;margin:6px 0 12px}
      .cg-row{display:flex;gap:8px;flex-wrap:wrap}
      .cg-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .cg-btn{appearance:none;border:0;border-radius:12px;padding:12px 16px;font-weight:700;cursor:pointer}
      .cg-btn.start{background:#16a34a;color:#fff}
      .cg-btn.stop{background:#dc2626;color:#fff}
      .cg-btn.mic{background:#2563eb;color:#fff}
      .cg-btn.secondary{background:#f3f4f6}
      .cg-btn:disabled{opacity:.5;cursor:not-allowed}
      .cg-wave{height:110px;background:#f3f4f6;border-radius:12px}
      .cg-label{font-size:14px;color:#374151;margin:8px 0 4px;display:block}
      .cg-input, .cg-text, .cg-select{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
      .cg-text{min-height:80px}
      .cg-msg{margin-top:10px;font-size:14px}
      .cg-msg.ok{color:#065f46}
      .cg-msg.err{color:#b91c1c}
      .cg-audio{width:100%;margin-top:10px}
      .cg-footer{font-size:12px;color:#6b7280;margin-top:12px}
      .cg-consent{display:flex;align-items:flex-start;gap:8px;margin-top:8px}
      .cg-chiprow{display:flex;flex-wrap:wrap;gap:8px}
      .cg-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #e5e7eb;border-radius:999px;padding:6px 10px}
      .cg-scale{display:flex;gap:8px;flex-wrap:wrap}
      .cg-pill{border:1px solid #e5e7eb;border-radius:999px;padding:8px 12px;cursor:pointer;background:#fff}
      .cg-pill[aria-pressed="true"]{background:#2563eb;color:#fff;border-color:#2563eb}
      .cg-ctrl{display:flex;gap:8px;align-items:center}
      .cg-step{width:40px;height:40px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:18px;cursor:pointer}
      .cg-temp{width:120px}
      @media (max-width:640px){.cg-col{grid-template-columns:1fr}}
    </style>
    <div class="cg-wrap">
      <h2 class="cg-h1">Cough Guard</h2>
      <p class="cg-sub">Record your cough, add symptoms, and (with consent) send securely to your physio or BreatheWell AI.</p>

      <div class="cg-card">
        <label class="cg-consent">
          <input id="cg-consent" type="checkbox" />
          <span>I understand this tool does not provide medical advice. I consent to share my recording and symptom details for clinical review and AI analysis.</span>
        </label>
        <div class="cg-row" style="margin-top:8px">
          <button id="cg-mic" class="cg-btn mic" disabled>Enable Microphone</button>
          <button id="cg-start" class="cg-btn start" disabled>● Start Recording</button>
          <button id="cg-stop" class="cg-btn stop" disabled>■ Stop Recording</button>
          <button id="cg-download" class="cg-btn secondary" disabled>Download recording</button>
        </div>
        <canvas id="cg-wave" class="cg-wave" style="margin-top:8px"></canvas>
        <audio id="cg-audio" class="cg-audio" controls style="display:none"></audio>
        <div id="cg-msg" class="cg-msg"></div>
      </div>

      <div class="cg-card">
        <h3 style="margin:0 0 8px;font-size:18px">Symptoms & context</h3>
        <div class="cg-col">
          <div>
            <label class="cg-label" for="cg-days">Days unwell</label>
            <input id="cg-days" class="cg-input" type="number" min="0" step="1" inputmode="numeric" placeholder="e.g., 3" />
          </div>
          <div>
            <label class="cg-label" for="cg-tempv">Temperature °C (optional)</label>
            <div class="cg-ctrl">
              <button id="cg-tminus" class="cg-step" type="button">–</button>
              <input id="cg-tempv" class="cg-input cg-temp" type="text" inputmode="decimal" placeholder="e.g., 37.8" />
              <button id="cg-tplus" class="cg-step" type="button">+</button>
            </div>
          </div>
          <div>
            <label class="cg-label">Breathlessness</label>
            <div id="cg-breath" class="cg-scale" role="group" aria-label="Breathlessness">
              ${pill('None',0)}${pill('Mild',3)}${pill('Moderate',7)}${pill('Severe',10)}
            </div>
          </div>
          <div>
            <label class="cg-label">Chest tightness</label>
            <div id="cg-tight" class="cg-scale" role="group" aria-label="Chest tightness">
              ${pill('None',0)}${pill('Mild',3)}${pill('Moderate',7)}${pill('Severe',10)}
            </div>
          </div>
          <div>
            <label class="cg-label">Cough frequency (past 24h)</label>
            <select id="cg-cfreq" class="cg-select">
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label class="cg-label">Sputum change</label>
            <select id="cg-sputum" class="cg-select">
              <option value="none">None</option>
              <option value="more">More than usual</option>
              <option value="thicker">Thicker</option>
              <option value="colour">Colour change (yellow/green/brown/bloody)</option>
            </select>
          </div>
          <div>
            <label class="cg-label" for="cg-spo2">SpO₂ % (optional)</label>
            <input id="cg-spo2" class="cg-input" type="number" min="50" max="100" step="1" inputmode="numeric" placeholder="e.g., 96" />
          </div>
          <div>
            <label class="cg-label" for="cg-hr">Heart rate bpm (optional)</label>
            <input id="cg-hr" class="cg-input" type="number" min="30" max="220" step="1" inputmode="numeric" placeholder="e.g., 88" />
          </div>
        </div>

        <div class="cg-label" style="margin-top:8px">Other symptoms</div>
        <div class="cg-chiprow">
          ${[ ['cg-fever','Fever/feverish'], ['cg-wheeze','Wheeze'], ['cg-chestpain','Chest pain'], ['cg-blue','Blue lips/face'], ['cg-confused','Confusion/drowsy'], ['cg-dehydr','Poor intake/low urine'], ['cg-runny','Runny/blocked nose'], ['cg-sorethroat','Sore throat'] ].map(([id,label])=>`<label class="cg-chip"><input id="${id}" type="checkbox"/> ${label}</label>`).join('')}
        </div>

        <div class="cg-label" style="margin-top:8px">Health background</div>
        <div class="cg-chiprow">
          ${[ ['cg-asthma','Asthma'], ['cg-copd','COPD'], ['cg-bronch','Bronchiectasis'], ['cg-cf','Cystic fibrosis'], ['cg-heart','Heart condition'], ['cg-immuno','Immunosuppressed'] ].map(([id,label])=>`<label class="cg-chip"><input id="${id}" type="checkbox"/> ${label}</label>`).join('')}
        </div>

        <label class="cg-label" for="cg-notes">Notes (optional)</label>
        <textarea id="cg-notes" class="cg-text" placeholder="Anything else you want your physio to know…"></textarea>

        <label class="cg-label" for="cg-photo">Upload photo (optional)</label>
        <input id="cg-photo" type="file" accept="image/*" capture="environment" />
      </div>

      <div class="cg-card">
        <div class="cg-row">
          <button id="cg-send" class="cg-btn mic" disabled>Send to BreatheWell AI (beta)</button>
          <button id="cg-export" class="cg-btn secondary">Download summary (.json)</button>
        </div>
        <div class="cg-footer">If sending fails, download the recording & summary and email them. Not a diagnostic tool.</div>
      </div>
    </div>
  `;

  // --- Helpers to build pills ------------------------------------------------
  function pill(label,val){ return `<button type="button" class="cg-pill" data-val="${val}" aria-pressed="false">${label}</button>`; }
  function setupPillScale(containerId){
    const el = host.querySelector('#'+containerId); let current = 0; const pills = Array.from(el.querySelectorAll('.cg-pill'));
    function select(val){ current = val; pills.forEach(p=>p.setAttribute('aria-pressed', String(Number(p.dataset.val)===val))); }
    pills.forEach(p=>p.addEventListener('click', ()=> select(Number(p.dataset.val))));
    select(0); // default None
    return () => current;
  }

  // --- Recording + state ----------------------------------------------------
  const $ = (sel) => host.querySelector(sel);
  const els = {
    consent: $('#cg-consent'), mic: $('#cg-mic'), start: $('#cg-start'), stop: $('#cg-stop'),
    audio: $('#cg-audio'), wave: $('#cg-wave'), msg: $('#cg-msg'), download: $('#cg-download'),
    send: $('#cg-send'), exportBtn: $('#cg-export'),
    days: $('#cg-days'), tempv: $('#cg-tempv'), tminus: $('#cg-tminus'), tplus: $('#cg-tplus'),
    cfreq: $('#cg-cfreq'), sputum: $('#cg-sputum'), spo2: $('#cg-spo2'), hr: $('#cg-hr'),
    notes: $('#cg-notes'), photo: $('#cg-photo')
  };
  const getBreath = setupPillScale('cg-breath');
  const getTight  = setupPillScale('cg-tight');

  let stream = null, recorder = null, chunks = [], latestBlob = null;

  // Consent gates controls
  els.consent.addEventListener('change', () => { const on = els.consent.checked; els.mic.disabled = !on; els.send.disabled = !on; els.start.disabled = !on; });

  // Temperature stepper (easier entry on iOS)
  function parseTemp(){ const s=(els.tempv.value||'').replace(/[^0-9.]/g,''); const n=parseFloat(s); return isNaN(n)?undefined:n; }
  function formatTemp(n){ if(n==null) return ''; return String(Math.round(n*10)/10); }
  els.tminus.addEventListener('click', ()=>{ const n=parseTemp(); const v=isNaN(n)?37.0:n; const next=Math.max(30,Math.min(43, v-0.1)); els.tempv.value = formatTemp(next); });
  els.tplus .addEventListener('click', ()=>{ const n=parseTemp(); const v=isNaN(n)?37.0:n; const next=Math.max(30,Math.min(43, v+0.1)); els.tempv.value = formatTemp(next); });

  // Numeric guards
  els.days.addEventListener('input', () => { const v = parseInt(els.days.value||''); if(isNaN(v)||v<0) els.days.value=''; });
  els.spo2.addEventListener('input', () => { const v = parseFloat(els.spo2.value||''); if(isNaN(v)||v<50||v>100) els.spo2.value=''; });
  els.hr.addEventListener('input',   () => { const v = parseFloat(els.hr.value||''); if(isNaN(v)||v<30||v>220) els.hr.value=''; });

  function setMsg(text, ok){ els.msg.textContent = text||''; els.msg.className = 'cg-msg ' + (ok===true?'ok':ok===false?'err':''); }

  function preferredMime(){ const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus']; for(const t of types){ if(window.MediaRecorder?.isTypeSupported?.(t)) return t; } return 'audio/webm'; }

  // Waveform visualiser
  let audioCtx, analyser, anim;
  function startWave(){ if(!stream) return; const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return; audioCtx = new AC(); const source = audioCtx.createMediaStreamSource(stream); analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024; source.connect(analyser); const cvs = els.wave, ctx = cvs.getContext('2d'); const data = new Uint8Array(analyser.fftSize); function draw(){ analyser.getByteTimeDomainData(data); ctx.clearRect(0,0,cvs.width,cvs.height); ctx.lineWidth=2; ctx.strokeStyle='#111827'; ctx.beginPath(); const step=cvs.width/data.length; let x=0; for(let i=0;i<data.length;i++){ const y=(data[i]/128.0)*cvs.height/2; i?ctx.lineTo(x,y):ctx.moveTo(x,y); x+=step; } ctx.lineTo(cvs.width,cvs.height/2); ctx.stroke(); anim=requestAnimationFrame(draw); } cvs.width=cvs.clientWidth*(window.devicePixelRatio||1); cvs.height=cvs.clientHeight*(window.devicePixelRatio||1); draw(); }
  function stopWave(){ if(anim) cancelAnimationFrame(anim); try{audioCtx&&audioCtx.close();}catch(e){} }

  // Enable microphone
  els.mic.addEventListener('click', async () => { try{ if(!navigator.mediaDevices?.getUserMedia){ setMsg('Recording is not supported in this browser. Try Chrome, Edge, or Safari.', false); return; } stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true } }); els.start.disabled = false; els.mic.disabled = true; setMsg('Microphone enabled. Tap Start to record.', true); startWave(); }catch(err){ setMsg('Microphone blocked. Allow mic access and reload.', false); } });

  // Start/Stop recording
  els.start.addEventListener('click', () => { if(!stream){ setMsg('Enable the microphone first.', false); return; } try{ chunks = []; const rec = new MediaRecorder(stream, { mimeType: preferredMime() }); recorder = rec; rec.ondataavailable = e => { if(e.data && e.data.size>0) chunks.push(e.data); }; rec.onstop = () => { const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); latestBlob = blob; const url = URL.createObjectURL(blob); els.audio.src = url; els.audio.style.display='block'; els.download.disabled=false; setMsg('Recording saved. You can play it back below or send it.', true); }; rec.start(); els.start.disabled=true; els.stop.disabled=false; setMsg('Recording… cough once or twice, then press Stop.', true); }catch(err){ setMsg('Could not start recording. Try another browser.', false); } });
  els.stop.addEventListener('click', () => { if(recorder && recorder.state!=='inactive') recorder.stop(); els.stop.disabled=true; els.start.disabled=false; setMsg('Processing recording…', true); });

  // Download recording
  els.download.addEventListener('click', () => { if(!latestBlob) return; const a=document.createElement('a'); const url=URL.createObjectURL(latestBlob); a.href=url; a.download='coughguard_recording.webm'; document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},0); });

  // Export summary JSON
  els.exportBtn.addEventListener('click', () => { const data = buildPayload(false); const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); const url=URL.createObjectURL(blob); a.href=url; a.download='coughguard_summary.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);},0); });

  // Send to AI or Netlify form
  els.send.addEventListener('click', async () => {
    if(!els.consent.checked){ setMsg('Please tick the consent box before sending.', false); return; }

    const payload = buildPayload(true);

    // Preferred: AI endpoint
    if (API_URL) {
      try {
        const fd = new FormData();
        fd.append('summary', JSON.stringify(payload));
        if(latestBlob){ const file = new File([latestBlob],'coughguard_recording.webm',{type:latestBlob.type||'audio/webm'}); fd.append('recording', file); }
        const photo = els.photo?.files?.[0]; if(photo) fd.append('photo', photo);
        const res = await fetch(API_URL, { method:'POST', body: fd });
        if(!res.ok) throw new Error('Bad status '+res.status);
        const data = await res.json().catch(()=>({}));
        if (data.pdf_url) {
          setMsg('Analysis complete. A PDF was generated for the patient.', true);
          window.open(data.pdf_url, '_blank');
        } else if (data.message) {
          setMsg(String(data.message), true);
        } else {
          setMsg('Sent for AI analysis. You will receive an email with results shortly.', true);
        }
        return;
      } catch (e) {
        setMsg('AI upload failed. Falling back to form/email.', false);
      }
    }

    // Fallback: Netlify Form if present
    const form = document.querySelector('form[name="coughguard"]');
    if(form){
      try{
        const fd = new FormData(form);
        for (const k of Array.from(fd.keys())) fd.delete(k);
        fd.append('form-name','coughguard');
        fd.append('summary', JSON.stringify(payload));
        if(latestBlob){ const file = new File([latestBlob],'coughguard_recording.webm',{type:latestBlob.type||'audio/webm'}); fd.append('recording', file); }
        const photoInput = els.photo; if(photoInput && photoInput.files && photoInput.files[0]) fd.append('photo', photoInput.files[0]);
        await fetch('/', { method:'POST', body: fd });
        setMsg('Sent! Your physio will receive your recording and summary.', true);
        return;
      }catch(e){ setMsg('Sending failed. Please download and email the files instead.', false); }
    }

    // Last resort: email draft
    const subject = encodeURIComponent('Cough Guard submission');
    const body = encodeURIComponent('Hi,

I used Cough Guard and will attach the downloaded recording and summary.

Thanks.');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setMsg('Email window opened. Please attach the downloaded files, then send.', true);
  });

  function buildPayload(includePrivate){
    const pick = id => !!host.querySelector('#'+id)?.checked;
    const temp = parseTemp();
    return {
      createdAt: new Date().toISOString(),
      consent: !!els.consent.checked,
      context: {
        daysUnwell: safeNum(els.days.value), temperatureC: isNaN(temp)?undefined:Math.round(temp*10)/10,
        breathlessness: getBreath(), chestTightness: getTight(),
        coughFrequency: els.cfreq.value, sputumChange: els.sputum.value,
        spo2: safeNum(els.spo2.value), heartRate: safeNum(els.hr.value),
        otherSymptoms: {
          feverish: pick('cg-fever'), wheeze: pick('cg-wheeze'), chestPain: pick('cg-chestpain'),
          blueLips: pick('cg-blue'), confusion: pick('cg-confused'), dehydration: pick('cg-dehydr'),
          runnyNose: pick('cg-runny'), soreThroat: pick('cg-sorethroat')
        },
        background: {
          asthma: pick('cg-asthma'), copd: pick('cg-copd'), bronchiectasis: pick('cg-bronch'),
          cysticFibrosis: pick('cg-cf'), heartCondition: pick('cg-heart'), immunosuppressed: pick('cg-immuno')
        },
        notes: els.notes.value||''
      },
      files: { hasRecording: !!latestBlob, hasPhoto: !!(els.photo && els.photo.files && els.photo.files[0]) }
    };
  }
  function parseTemp(){ const s=(els.tempv.value||'').replace(/[^0-9.]/g,''); const n=parseFloat(s); return n; }
  function safeNum(v){ const n=parseFloat(v); return isNaN(n)?undefined:n; }

  // Cleanup
  window.addEventListener('pagehide', () => { try{stream?.getTracks().forEach(t=>t.stop());}catch(e){} stopWave(); });
})();
