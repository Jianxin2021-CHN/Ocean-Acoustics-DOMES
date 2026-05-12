// ============================================
// Spectrum View - LOFAR Audio Visualization
// ============================================

// --- UI Elements ---
const fileInput = document.getElementById('fileInput');
const playBtn = document.getElementById('playBtn');
const progressBar = document.getElementById('progressBar');
const container = document.getElementById('visContainer');
const lofarCanvas = document.getElementById('lofarCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const interactionLayer = document.getElementById('interactionLayer');
const hoverInfo = document.getElementById('hoverInfo');
const statusText = document.getElementById('statusText');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// --- Canvas Contexts ---
const ctx = lofarCanvas.getContext('2d', { alpha: false });
const ctxOverlay = overlayCanvas.getContext('2d');
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

// --- Audio Core Variables ---
let audioCtx = null;
let audioBuffer = null;
let sourceNode = null;
let analyser = null;
let isPlaying = false;
let startTime = 0;
let pausedAt = 0;
let animationId = null;

// --- LOFAR Config ---
const FFT_SIZE = 2048;
let freqData = new Uint8Array(FFT_SIZE / 2);
let colorPalette = new Uint32Array(256);
const MAX_FREQ_LIMIT = 8000;
let maxFreqIndexLimit = FFT_SIZE / 2;

// --- Drawing and Audio Logic ---

function resizeCanvas() {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (lofarCanvas.width !== w || lofarCanvas.height !== h) {
        lofarCanvas.width = w;
        lofarCanvas.height = h;
        overlayCanvas.width = w;
        overlayCanvas.height = h;
        tempCanvas.width = w;
        tempCanvas.height = h;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        tempCtx.fillStyle = '#000';
        tempCtx.fillRect(0, 0, w, h);
    }
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

function initPalette() {
    const buf = new ArrayBuffer(4);
    const buf8 = new Uint8ClampedArray(buf);
    const buf32 = new Uint32Array(buf);
    for (let i = 0; i < 256; i++) {
        let t = i / 255;
        let r, g, b;
        if (t < 0.1) { r = t * 400; g = 0; b = t * 600 + 40; }
        else if (t < 0.4) { r = (t - 0.1) * 600 + 40; g = 20; b = 180 - (t - 0.1) * 400; }
        else if (t < 0.7) { r = 255; g = (t - 0.4) * 600 + 20; b = 0; }
        else if (t < 0.9) { r = 255; g = (t - 0.7) * 400 + 200; b = (t - 0.7) * 200; }
        else { r = 255; g = 255; b = (t - 0.9) * 2550 + 40; }
        buf8[0] = Math.min(255, r);
        buf8[1] = Math.min(255, g);
        buf8[2] = Math.min(255, b);
        buf8[3] = 255;
        colorPalette[i] = buf32[0];
    }
}
initPalette();

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameDisplay.innerText = file.name;
    statusText.innerText = "Processing audio...";
    playBtn.disabled = true;

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    try {
        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const nyquistFreq = audioCtx.sampleRate / 2;
        const limitRatio = Math.min(1, MAX_FREQ_LIMIT / nyquistFreq);
        maxFreqIndexLimit = Math.floor(limitRatio * (FFT_SIZE / 2));
        statusText.innerText = `Ready (Fs: ${audioCtx.sampleRate/1000}kHz | Limit: ${MAX_FREQ_LIMIT}Hz)`;
        document.getElementById('duration').innerText = formatTime(audioBuffer.duration);
        progressBar.max = audioBuffer.duration;
        progressBar.value = 0;
        progressBar.disabled = false;
        playBtn.disabled = false;
        pausedAt = 0;
        if (isPlaying) stopPlayback();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, lofarCanvas.width, lofarCanvas.height);
    } catch (err) {
        statusText.innerText = "Error decoding file";
        console.error(err);
    }
});

playBtn.addEventListener('click', () => {
    if (isPlaying) { stopPlayback(true); }
    else { startPlayback(); }
});

progressBar.addEventListener('input', () => {
    document.getElementById('currentTime').innerText = formatTime(progressBar.value);
});

progressBar.addEventListener('change', () => {
    pausedAt = parseFloat(progressBar.value);
    if (isPlaying) { sourceNode.stop(); startPlayback(); }
});

function startPlayback() {
    if (!audioBuffer) return;
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }

    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.0;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    sourceNode.start(0, pausedAt);
    startTime = audioCtx.currentTime - pausedAt;
    isPlaying = true;
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    playBtn.classList.replace('btn-primary', 'btn-secondary');
    drawLoop();
    sourceNode.onended = () => {
        if (Math.abs(audioCtx.currentTime - startTime - audioBuffer.duration) < 0.1) {
            stopPlayback(false);
            pausedAt = 0;
            progressBar.value = 0;
            document.getElementById('currentTime').innerText = formatTime(audioBuffer.duration);
        }
    };
}

function stopPlayback(isPause = false) {
    if (sourceNode) {
        try { sourceNode.onended = null; sourceNode.stop(); } catch(e){}
    }
    if (isPause) pausedAt = audioCtx.currentTime - startTime;
    isPlaying = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    playBtn.classList.replace('btn-secondary', 'btn-primary');
}

function drawLoop() {
    if (!isPlaying || !analyser) return;
    animationId = requestAnimationFrame(drawLoop);
    analyser.getByteFrequencyData(freqData);

    const curr = audioCtx.currentTime - startTime;
    progressBar.value = curr;
    document.getElementById('currentTime').innerText = formatTime(curr);

    const w = lofarCanvas.width;
    const h = lofarCanvas.height;
    const speed = 2;

    tempCtx.drawImage(lofarCanvas, 0, 0);
    ctx.drawImage(tempCanvas, -speed, 0);

    const imgData = ctx.createImageData(speed, h);
    const data = new Uint32Array(imgData.data.buffer);
    const limitIndex = maxFreqIndexLimit;

    for (let y = 0; y < h; y++) {
        const normalizedY = 1 - (y / h);
        const freqIndex = Math.floor(normalizedY * limitIndex);
        const value = (freqIndex >= 0 && freqIndex < freqData.length) ? freqData[freqIndex] : 0;
        const color = colorPalette[value];
        for (let x = 0; x < speed; x++) {
            data[y * speed + x] = color;
        }
    }
    ctx.putImageData(imgData, w - speed, 0);
}

// --- Interaction Logic ---
interactionLayer.addEventListener('mousemove', (e) => {
    if (!audioBuffer) return;
    const rect = interactionLayer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const normalizedY = 1 - (y / h);
    const freq = normalizedY * MAX_FREQ_LIMIT;
    const freqStr = freq > 1000 ? (freq/1000).toFixed(2) + ' kHz' : Math.round(freq) + ' Hz';
    const currentTime = progressBar.value;
    const timeStr = formatTime(currentTime);

    ctxOverlay.clearRect(0, 0, w, h);
    ctxOverlay.beginPath();
    ctxOverlay.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctxOverlay.setLineDash([4, 4]);
    ctxOverlay.lineWidth = 1;
    ctxOverlay.moveTo(x, 0);
    ctxOverlay.lineTo(x, h);
    ctxOverlay.moveTo(0, y);
    ctxOverlay.lineTo(w, y);
    ctxOverlay.stroke();

    hoverInfo.style.display = 'block';
    hoverInfo.style.left = (e.clientX + 15) + 'px';
    hoverInfo.style.top = (e.clientY + 15) + 'px';
    hoverInfo.innerHTML =
        `Freq: <span style="color:var(--accent-primary)">${freqStr}</span><br>` +
        `Time: <span style="color:var(--accent-primary)">${timeStr}</span>`;
});

interactionLayer.addEventListener('mouseleave', () => {
    ctxOverlay.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    hoverInfo.style.display = 'none';
});