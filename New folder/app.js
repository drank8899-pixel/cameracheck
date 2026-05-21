const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('start-btn');
const captureBtn = document.getElementById('capture-btn');
const realtimeBtn = document.getElementById('realtime-btn');
const stopBtn = document.getElementById('stop-btn');
const resultDiv = document.getElementById('result');
const previewImg = document.getElementById('preview');
const overlay = document.getElementById('overlay');

let stream = null;
let detectionInterval = null;
let isRealtime = false;

startBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', captureImage);
realtimeBtn.addEventListener('click', toggleRealtime);
stopBtn.addEventListener('click', stopCamera);

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        startBtn.disabled = true;
        captureBtn.disabled = false;
        realtimeBtn.disabled = false;
        stopBtn.disabled = false;
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('ไม่สามารถเข้าถึงกล้องได้: ' + err.message);
    }
}

function captureImage() {
    stopRealtime();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');
        resultDiv.innerHTML = '<div class="loading">กำลังตรวจจับวัตถุ...</div>';

        try {
            const response = await fetch('/detect', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            displayResults(data);
        } catch (err) {
            console.error('Detection error:', err);
            resultDiv.innerHTML = '<p style="color: #ff6b6b;">เกิดข้อผิดพลาดในการตรวจจับ</p>';
        }
    }, 'image/jpeg', 0.8);
}

function toggleRealtime() {
    if (isRealtime) {
        stopRealtime();
    } else {
        startRealtime();
    }
}

function startRealtime() {
    isRealtime = true;
    realtimeBtn.textContent = 'หยุดตรวจจับแบบเรียลไทม์';
    captureBtn.disabled = true;
    detectionInterval = setInterval(captureAndDetect, 500);
}

function stopRealtime() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    isRealtime = false;
    realtimeBtn.textContent = 'เริ่มตรวจจับแบบเรียลไทม์';
    captureBtn.disabled = false;
    clearOverlay();
}

function captureAndDetect() {
    if (!isRealtime) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');

        try {
            const response = await fetch('/detect', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            displayResults(data, true);
        } catch (err) {
            console.error('Detection error:', err);
        }
    }, 'image/jpeg', 0.7);
}

function displayResults(data, isRealtimeMode = false) {
    if (isRealtimeMode) {
        drawOverlay(data.detections);
        resultDiv.innerHTML = '';
        previewImg.style.display = 'none';
        return;
    }

    previewImg.src = data.image || '';
    previewImg.style.display = data.image ? 'block' : 'none';

    if (data.detections && data.detections.length > 0) {
        let html = '<h3>ผลการตรวจจับ:</h3>';
        data.detections.forEach(det => {
            html += `<div class="detection-item">
                ${det.label} - ความมั่นใจ ${(det.confidence * 100).toFixed(1)}%
            </div>`;
        });
        resultDiv.innerHTML = html;
    } else {
        resultDiv.innerHTML = '<p>ไม่พบวัตถุในภาพ</p>';
    }
}

function drawOverlay(detections) {
    clearOverlay();
    if (!detections || detections.length === 0) return;

    const videoRect = video.getBoundingClientRect();
    const scaleX = videoRect.width;
    const scaleY = videoRect.height;

    detections.forEach(det => {
        const box = det.box;
        const x1 = box[1] * scaleX;
        const y1 = box[0] * scaleY;
        const x2 = box[3] * scaleX;
        const y2 = box[2] * scaleY;

        const div = document.createElement('div');
        div.className = 'box-overlay';
        div.style.left = x1 + 'px';
        div.style.top = y1 + 'px';
        div.style.width = (x2 - x1) + 'px';
        div.style.height = (y2 - y1) + 'px';

        const label = document.createElement('span');
        label.className = 'box-label';
        label.textContent = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
        div.appendChild(label);

        overlay.appendChild(div);
    });
}

function clearOverlay() {
    overlay.innerHTML = '';
}

function stopCamera() {
    stopRealtime();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
    startBtn.disabled = false;
    captureBtn.disabled = true;
    realtimeBtn.disabled = true;
    stopBtn.disabled = true;
    resultDiv.innerHTML = '';
    previewImg.style.display = 'none';
    clearOverlay();
}