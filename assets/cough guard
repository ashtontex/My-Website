// coughguard.js - Patient-friendly Cough Guard for plain HTML sites
// Drop this file into your assets folder and link it in index.html

(function(){
  const container = document.getElementById('cough-guard');
  if(!container) return;

  container.innerHTML = `
    <style>
      #cg-app { font-family: Arial, sans-serif; max-width: 600px; margin: auto; }
      #cg-app button { padding: 10px 15px; border-radius: 8px; border: none; cursor: pointer; }
      #cg-app input, #cg-app textarea { width: 100%; padding: 8px; margin: 5px 0; }
      #cg-waveform { width: 100%; height: 100px; background: #f1f1f1; margin: 10px 0; }
      .cg-section { border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-top: 10px; background: white; }
    </style>
    <div id="cg-app">
      <h2>Cough Guard</h2>
      <p>A simple, private way to record cough sounds and share with your physio.</p>
      <div class="cg-section">
        <button id="cg-enable-mic">Enable Microphone</button>
        <button id="cg-start-rec" disabled>● Start Recording</button>
        <button id="cg-stop-rec" disabled>■ Stop Recording</button>
        <canvas id="cg-waveform"></canvas>
        <audio id="cg-audio" controls style="display:none;"></audio>
      </div>
      <div class="cg-section">
        <label>Days unwell: <input type="number" id="cg-days-unwell"></label>
        <label>Notes: <textarea id="cg-notes"></textarea></label>
        <label>Upload photo: <input type="file" id="cg-photo" accept="image/*" capture="environment"></label>
      </div>
    </div>
  `;

  let mediaRecorder, chunks = [], audioURL = '', stream;
  const enableMicBtn = document.getElementById('cg-enable-mic');
  const startBtn = document.getElementById('cg-start-rec');
  const stopBtn = document.getElementById('cg-stop-rec');
  const audioEl = document.getElementById('cg-audio');

  enableMicBtn.onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      enableMicBtn.disabled = true;
      startBtn.disabled = false;
      alert('Microphone enabled. You can start recording.');
    } catch (e) {
      alert('Microphone access denied.');
    }
  };

  startBtn.onclick = () => {
    chunks = [];
    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
  };

  stopBtn.onclick = () => {
    mediaRecorder.stop();
    stopBtn.disabled = true;
    startBtn.disabled = false;
  };

  mediaRecorder && (mediaRecorder.ondataavailable = e => {
    chunks.push(e.data);
  });

  mediaRecorder && (mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    audioURL = URL.createObjectURL(blob);
    audioEl.src = audioURL;
    audioEl.style.display = 'block';
  });
})();
