// ============================================
// Annotation Manager - Time-Frequency Labeling
// ============================================

// --- Color Palette ---
function ensureColorPalette() {
    if (window.colorPalette && window.colorPalette.length === 256) return;
    
    window.colorPalette = new Uint32Array(256);
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
        window.colorPalette[i] = buf32[0];
    }
}

// --- WAV Parser ---
class BinaryWavParser {
    static async parse(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        if (view.getUint32(0, false) !== 0x52494646) throw new Error("Not a RIFF file");
        if (view.getUint32(8, false) !== 0x57415645) throw new Error("Not a WAVE file");

        let offset = 12;
        let sampleRate = 0, channels = 0, bitDepth = 0, dataOffset = 0, dataLen = 0;

        while (offset < view.byteLength) {
            const chunkId = view.getUint32(offset, false);
            const chunkSize = view.getUint32(offset + 4, true);
            if (chunkId === 0x666d7420) {
                channels = view.getUint16(offset + 8, true);
                sampleRate = view.getUint32(offset + 12, true);
                bitDepth = view.getUint16(offset + 22, true);
            } else if (chunkId === 0x64617461) {
                dataOffset = offset + 8;
                dataLen = chunkSize;
                break;
            }
            offset += 8 + chunkSize;
        }

        const sampleCount = Math.floor(dataLen / (bitDepth / 8));
        const floatData = new Float32Array(Math.floor(sampleCount / channels));
        
        if (bitDepth === 16) {
            for (let i = 0, j = dataOffset; i < floatData.length; i++, j += 2 * channels) {
                floatData[i] = view.getInt16(j, true) / 32768;
            }
        } else if (bitDepth === 24) {
            for (let i = 0, j = dataOffset; i < floatData.length; i++, j += 3 * channels) {
                const b1 = view.getUint8(j), b2 = view.getUint8(j+1), b3 = view.getUint8(j+2);
                let val = (b1 << 8) | (b2 << 16) | (b3 << 24);
                floatData[i] = (val >> 8) / 8388608;
            }
        }
        return { floatData, sampleRate, duration: floatData.length / sampleRate };
    }
}

// --- FFT ---
class FastFFT {
    constructor(n) {
        this.n = n;
        this.cos = new Float32Array(n / 2);
        this.sin = new Float32Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            this.cos[i] = Math.cos(-2 * Math.PI * i / n);
            this.sin[i] = Math.sin(-2 * Math.PI * i / n);
        }
    }
    forward(real) {
        let n = this.n, j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) [real[i], real[j]] = [real[j], real[i]];
            let k = n >> 1;
            while (k <= j) { j -= k; k >>= 1; } j += k;
        }
        let imag = new Float32Array(n);
        for (let step = 1; step < n; step <<= 1) {
            let jump = step << 1;
            for (let i = 0; i < step; i++) {
                let c = this.cos[i * n / jump], s = this.sin[i * n / jump];
                for (let k = i; k < n; k += jump) {
                    let re = real[k + step] * c - imag[k + step] * s;
                    let im = real[k + step] * s + imag[k + step] * c;
                    real[k + step] = real[k] - re; imag[k + step] = imag[k] - im;
                    real[k] += re; imag[k] += im;
                }
            }
        }
        let mags = new Float32Array(n / 2);
        for (let i = 0; i < n / 2; i++) mags[i] = Math.sqrt(real[i]**2 + imag[i]**2);
        return mags;
    }
}

// --- State ---
let anno_audio_files = [];
let anno_current_idx = -1;
let anno_records = [];
let anno_is_drawing = false;
let anno_start_pos = { x: 0, y: 0 };

// --- File Upload ---
async function handleAnnoBatchUpload(e) {
    const files = Array.from(e.target.files);
    for (let f of files) {
        anno_audio_files.push({ 
            id: 'f' + Date.now() + Math.random().toString(36).substr(2, 9), 
            file: f, 
            name: f.name, 
            status: 'Ready' 
        });
    }
    renderAnnoList();
    e.target.value = '';
}

function renderAnnoList() {
    const list = document.getElementById('anno_file_list');
    if (anno_audio_files.length === 0) {
        list.innerHTML = '<div class="empty-files">No files found</div>';
        return;
    }
    
    list.innerHTML = anno_audio_files.map((f, i) => `
        <div class="anno-file-unit ${i === anno_current_idx ? 'anno-active-item' : ''}" onclick="selectAnnoTask(${i})">
            <div class="anno-filename-text">${f.name}</div>
            <div class="anno-file-status">${f.status}</div>
        </div>
    `).join('');
}

// --- Select Task ---
async function selectAnnoTask(idx) {
    anno_current_idx = idx;
    renderAnnoList();
    const task = anno_audio_files[idx];
    document.getElementById('anno_loading').classList.add('active');

    try {
        ensureColorPalette();
        const buffer = await task.file.arrayBuffer();
        const { floatData, sampleRate, duration } = await BinaryWavParser.parse(buffer);
        task.duration = duration;
        task.status = duration.toFixed(1) + 's | Parsed';
        renderAnnoList();
        await drawAnnoLOFAR(floatData, sampleRate);
        refreshAnnoOverlay();
        updateStatus(`FILE: ${task.name} | ${duration.toFixed(1)}s | ${sampleRate}Hz`);
    } catch (e) {
        alert("Binary Parse Error: " + e.message);
        updateStatus("ERROR: " + e.message);
    } finally {
        document.getElementById('anno_loading').classList.remove('active');
    }
}

async function drawAnnoLOFAR(data, fs) {
    const canvas = document.getElementById('anno_lofar_canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = canvas.parentElement.clientHeight;

    const fftSize = 2048;
    const fft = new FastFFT(fftSize);
    const step = Math.floor((data.length - fftSize) / width);
    const imgData = ctx.createImageData(width, height);
    const data32 = new Uint32Array(imgData.data.buffer);

    const maxHz = 8000;
    const maxIdx = Math.floor((maxHz / (fs/2)) * (fftSize/2));

    for (let x = 0; x < width; x++) {
        const slice = data.slice(x * step, x * step + fftSize);
        if (slice.length < fftSize) break;
        
        // Hamming window
        for(let i = 0; i < fftSize; i++) {
            slice[i] *= (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (fftSize - 1)));
        }
        
        const mags = fft.forward(slice);

        for (let y = 0; y < height; y++) {
            let idx = Math.floor((1 - y/height) * maxIdx);
            if (isNaN(idx)) idx = 0;
            const db = 20 * Math.log10(mags[idx] + 1e-6);
            let intensity = Math.floor(((db + 100) / 70) * 255);
            intensity = Math.max(0, Math.min(255, intensity));
            data32[y * width + x] = window.colorPalette[intensity];
        }
        
        if (x % 500 === 0) await new Promise(r => requestAnimationFrame(r));
    }
    ctx.putImageData(imgData, 0, 0);
}

// --- Annotation Drawing ---
const anno_mark = document.getElementById('anno_mark_layer');
const anno_box = document.getElementById('anno_selector_box');

document.addEventListener('DOMContentLoaded', () => {
    anno_mark.addEventListener('mousedown', (e) => {
        if (anno_current_idx === -1) return;
        anno_is_drawing = true;
        const r = anno_mark.getBoundingClientRect();
        anno_start_pos = { x: e.clientX - r.left, y: e.clientY - r.top };
        anno_box.style.display = 'block';
        anno_box.style.width = '0px';
        anno_box.style.height = '0px';
        anno_box.style.left = anno_start_pos.x + 'px';
        anno_box.style.top = anno_start_pos.y + 'px';
    });
});

window.addEventListener('mousemove', (e) => {
    if (!anno_is_drawing) return;
    const r = anno_mark.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
    const w = x - anno_start_pos.x;
    const h = y - anno_start_pos.y;
    anno_box.style.width = Math.abs(w) + 'px';
    anno_box.style.height = Math.abs(h) + 'px';
    anno_box.style.left = (w > 0 ? anno_start_pos.x : x) + 'px';
    anno_box.style.top = (h > 0 ? anno_start_pos.y : y) + 'px';
});

window.addEventListener('mouseup', () => {
    if (!anno_is_drawing) return;
    anno_is_drawing = false;
    const px = parseFloat(anno_box.style.left);
    const py = parseFloat(anno_box.style.top);
    const pw = parseFloat(anno_box.style.width);
    const ph = parseFloat(anno_box.style.height);
    
    if (pw > 10 && ph > 10) {
        const file = anno_audio_files[anno_current_idx];
        const cvs = document.getElementById('anno_mark_layer');
        anno_records.push({
            id: Date.now(),
            fileId: file.id,
            label: 'Vessel',
            t: [(px/cvs.width*file.duration).toFixed(2), ((px+pw)/cvs.width*file.duration).toFixed(2)],
            f: [Math.round((1-(py+ph)/cvs.height)*8000), Math.round((1-py/cvs.height)*8000)],
            view: { px, py, pw, ph }
        });
        updateTable();
        refreshAnnoOverlay();
        updateStatus(`ANNOTATION ADDED: ${anno_records.length} total`);
    }
    anno_box.style.display = 'none';
});

function updateTable() {
    const tbody = document.getElementById('anno_table_body');
    if (anno_records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-sub);padding:20px;">No annotations yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = anno_records.map((r, i) => `
        <tr>
            <td>
                <select class="anno-label-select" onchange="anno_records[${i}].label=this.value">
                    <option ${r.label === 'Vessel' ? 'selected' : ''}>Vessel</option>
                    <option ${r.label === 'Whale' ? 'selected' : ''}>Whale</option>
                    <option ${r.label === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                    <option ${r.label === 'Ambient' ? 'selected' : ''}>Ambient</option>
                </select>
            </td>
            <td>${r.t[0]}s - ${r.t[1]}s</td>
            <td>${r.f[0]}Hz - ${r.f[1]}Hz</td>
            <td>${(r.t[1]-r.t[0]).toFixed(2)}s</td>
            <td><button class="anno-btn-delete" onclick="deleteAnno(${i})">Delete</button></td>
        </tr>
    `).join('');
}

function deleteAnno(index) {
    anno_records.splice(index, 1);
    updateTable();
    refreshAnnoOverlay();
    updateStatus(`ANNOTATION DELETED: ${anno_records.length} remaining`);
}

function refreshAnnoOverlay() {
    const cvs = document.getElementById('anno_mark_layer');
    const ctx = cvs.getContext('2d');
    cvs.width = cvs.parentElement.clientWidth;
    cvs.height = cvs.parentElement.clientHeight;
    if (anno_current_idx === -1) return;
    
    const fid = anno_audio_files[anno_current_idx].id;
    anno_records.forEach(r => {
        if (r.fileId === fid) {
            ctx.strokeStyle = '#00FF00';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeRect(r.view.px, r.view.py, r.view.pw, r.view.ph);
            ctx.fillStyle = '#00FF00';
            ctx.font = '12px monospace';
            ctx.fillText(r.label, r.view.px, r.view.py - 5);
        }
    });
}

// --- Actions ---
function clearAllAnnos() {
    if (anno_records.length === 0) return;
    if (confirm("Clear all annotations? This cannot be undone.")) {
        anno_records = [];
        updateTable();
        refreshAnnoOverlay();
        updateStatus("ALL ANNOTATIONS CLEARED");
    }
}

function exportAnnoData() {
    if (!anno_records.length) {
        alert("No data to export");
        return;
    }
    
    const exportData = anno_records.map(r => ({
        category: r.label,
        timeStart: parseFloat(r.t[0]),
        timeEnd: parseFloat(r.t[1]),
        freqLow: r.f[0],
        freqHigh: r.f[1],
        duration: parseFloat((r.t[1]-r.t[0]).toFixed(2))
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'annotations_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    
    updateStatus("EXPORTED: " + exportData.length + " annotations");
}

function updateStatus(msg) {
    document.getElementById('anno_status_info').innerHTML = `<span>${msg}</span>`;
}