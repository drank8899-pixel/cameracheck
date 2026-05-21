/**
 * AI Object Detection Web App Pro
 * Features: Object Detection + Direction Detection + Color Recognition
 * Uses TensorFlow.js and COCO-SSD for real-time object detection
 */

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusBar = document.getElementById('status-bar');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const noDetections = document.getElementById('no-detections');

// Direction Dashboard Elements
const leftDetections = document.getElementById('left-detections');
const centerDetections = document.getElementById('center-detections');
const rightDetections = document.getElementById('right-detections');
const directionTabs = document.querySelectorAll('.direction-tab');

// State Variables
let stream = null;
let model = null;
let isDetecting = false;
let usingFrontCamera = false;
let animationId = null;
let currentDirection = 'center';
let currentPredictions = [];

// Direction Detection Algorithm:
// Calculate bounding box center X coordinate and compare to video width
// Left: centerX < 1/3 of width
// Center: 1/3 <= centerX <= 2/3 of width
// Right: centerX > 2/3 of width

/**
 * Color Recognition Algorithm:
 * 1. Sample pixels from center region of bounding box
 * 2. Calculate average RGB values
 * 3. Convert RGB to closest basic color name using Euclidean distance in RGB space
 */

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();

    statusBar.textContent = 'กำลังโหลดโมเดล AI...';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-yellow-600 animate-pulse';

    try {
        model = await cocoSsd.load();
        statusBar.textContent = 'ระบบพร้อมทำงาน - กด "เริ่มการทำงาน"';
        statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-green-600';
        startBtn.disabled = false;
    } catch (error) {
        console.error('Failed to load model:', error);
        statusBar.textContent = 'เกิดข้อผิดพลาดในการโหลดโมเดล';
        statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-red-600';
    }
}

function setupEventListeners() {
    startBtn.addEventListener('click', startCamera);
    pauseBtn.addEventListener('click', toggleDetection);
    switchCameraBtn.addEventListener('click', switchCamera);

    directionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentDirection = tab.dataset.direction;
            updateDirectionTabs();
            showDirectionContent(currentDirection);
        });
    });
}

function updateDirectionTabs() {
    directionTabs.forEach(tab => {
        if (tab.dataset.direction === currentDirection) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function showDirectionContent(direction) {
    leftDetections.classList.toggle('hidden', direction !== 'left');
    centerDetections.classList.toggle('hidden', direction !== 'center');
    rightDetections.classList.toggle('hidden', direction !== 'right');
}

async function startCamera() {
    try {
        const constraints = {
            video: { facingMode: { ideal: "environment" } }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        startBtn.disabled = true;
        pauseBtn.disabled = false;
        switchCameraBtn.disabled = false;

        video.onloadedmetadata = () => {
            video.play();
            statusBar.textContent = 'กล้องพร้อม - กด "หยุดชั่วคราว" เพื่อเริ่มตรวจจับ';
            statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-green-600';
        };

        startDetection();

    } catch (error) {
        console.error('Error accessing camera:', error);
        tryFallbackCamera();
    }
}

async function tryFallbackCamera() {
    try {
        const frontConstraints = { video: { facingMode: "user" } };
        stream = await navigator.mediaDevices.getUserMedia(frontConstraints);
        video.srcObject = stream;
        usingFrontCamera = true;

        startBtn.disabled = true;
        pauseBtn.disabled = false;
        switchCameraBtn.disabled = false;

        video.onloadedmetadata = () => video.play();
        statusBar.textContent = 'ใช้กล้องหน้าระบบพร้อม';

        startDetection();
    } catch (fallbackError) {
        statusBar.textContent = 'ไม่สามารถเข้าถึงกล้องได้';
        statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-red-600';
    }
}

async function switchCamera() {
    if (!stream) return;

    stream.getTracks().forEach(track => track.stop());
    const newFacingMode = usingFrontCamera ? "environment" : "user";

    try {
        const constraints = { video: { facingMode: newFacingMode } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        usingFrontCamera = !usingFrontCamera;

        statusBar.textContent = `เปลี่ยนเป็นกล้อง${usingFrontCamera ? 'หน้า' : 'หลัง'}แล้ว`;
        setTimeout(() => {
            statusBar.textContent = 'กล้องพร้อม - กด "หยุดชั่วคราว" เพื่อเริ่มตรวจจับ';
        }, 1500);
    } catch (error) {
        statusBar.textContent = 'ไม่สามารถสลับกล้องได้';
    }
}

function startDetection() {
    isDetecting = true;
    statusBar.textContent = 'กำลังตรวจจับวัตถุ...';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-blue-600 animate-pulse';
    detectFrame();
}

function toggleDetection() {
    if (isDetecting) {
        pauseDetection();
    } else {
        resumeDetection();
    }
}

function pauseDetection() {
    isDetecting = false;
    pauseBtn.textContent = 'เริ่มตรวจจับ';

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    clearCanvas();
    statusBar.textContent = 'หยุดชั่วคราว - กดเพื่อเริ่มใหม่';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-yellow-600';
}

function resumeDetection() {
    isDetecting = true;
    pauseBtn.textContent = 'หยุดชั่วคราว';
    statusBar.textContent = 'กำลังตรวจจับวัตถุ...';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-blue-600 animate-pulse';
    detectFrame();
}

async function detectFrame() {
    if (!isDetecting || !model) return;

    try {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
            animationId = requestAnimationFrame(detectFrame);
            return;
        }

        const predictions = await model.detect(video);
        renderDetections(predictions, videoWidth);

    } catch (error) {
        console.error('Detection error:', error);
    }

    animationId = requestAnimationFrame(detectFrame);
}

/**
 * Direction Detection Algorithm:
 * Calculates object position relative to screen width
 * Left: centerX < 1/3 of width
 * Center: 1/3 <= centerX <= 2/3 of width
 * Right: centerX > 2/3 of width
 */
function getDirection(bbox, videoWidth) {
    const [x, y, width, height] = bbox;
    const centerX = x + width / 2;
    const third = videoWidth / 3;

    if (centerX < third) return 'left';
    if (centerX > 2 * third) return 'right';
    return 'center';
}

/**
 * Color Recognition Algorithm:
 * 1. Extract pixels from center region of bounding box
 * 2. Calculate average RGB values
 * 3. Find closest color name using RGB Euclidean distance
 */
function getColorFromBBox(bbox) {
    try {
        // Create temp canvas to extract pixel data
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const [x, y, width, height] = bbox;

        // Sample from center region for better color accuracy
        const sampleWidth = Math.max(10, Math.min(50, width * 0.4));
        const sampleHeight = Math.max(10, Math.min(50, height * 0.4));
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const sx = centerX - sampleWidth / 2;
        const sy = centerY - sampleHeight / 2;

        // Draw video frame to temp canvas at original resolution
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        tempCtx.drawImage(video, 0, 0);

        // Get pixel data from center region
        const imageData = tempCtx.getImageData(sx, sy, sampleWidth, sampleHeight);
        const data = imageData.data;

        // Calculate average RGB
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }

        const pixelCount = data.length / 4;
        r = Math.round(r / pixelCount);
        g = Math.round(g / pixelCount);
        b = Math.round(b / pixelCount);

        return rgbToColorName(r, g, b);
    } catch (error) {
        console.error('Color detection error:', error);
        return 'Unknown';
    }
}

/**
 * RGB to Color Name conversion using Euclidean distance
 * Finds the closest named color from predefined basic colors
 */
function rgbToColorName(r, g, b) {
    const colors = [
        { name: 'Red', rgb: [239, 68, 68] },
        { name: 'Green', rgb: [34, 197, 94] },
        { name: 'Blue', rgb: [59, 130, 246] },
        { name: 'Yellow', rgb: [234, 179, 8] },
        { name: 'Black', rgb: [17, 17, 17] },
        { name: 'White', rgb: [243, 244, 246] },
        { name: 'Orange', rgb: [249, 115, 22] },
        { name: 'Purple', rgb: [168, 85, 247] },
        { name: 'Pink', rgb: [236, 72, 153] },
        { name: 'Brown', rgb: [146, 64, 14] },
        { name: 'Gray', rgb: [107, 114, 128] },
        { name: 'Cyan', rgb: [6, 182, 212] }
    ];

    let minDistance = Infinity;
    let closestColor = 'Unknown';

    for (const color of colors) {
        const [cr, cg, cb] = color.rgb;
        // Euclidean distance in RGB space
        const distance = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color.name;
        }
    }

    return closestColor;
}

function renderDetections(predictions, videoWidth) {
    currentPredictions = predictions;
    const ctx = canvas.getContext('2d');

    canvas.width = videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Group detections by direction
    const detectionsByDirection = { left: [], center: [], right: [] };

    predictions.forEach(prediction => {
        const direction = getDirection(prediction.bbox, videoWidth);
        const color = getColorFromBBox(prediction.bbox);
        const confidence = Math.round(prediction.score * 100);

        detectionsByDirection[direction].push({
            ...prediction,
            color,
            confidence
        });

        // Draw bounding box
        const [x, y, width, height] = prediction.bbox;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw label with color and direction
        const labelText = `${color} ${prediction.class} - ${confidence}% (${getDirectionText(direction)})`;
        ctx.font = 'bold 14px sans-serif';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = '#00ff88';
        ctx.fillRect(x, y - 22, textWidth + 10, 22);

        ctx.fillStyle = '#000';
        ctx.fillText(labelText, x + 5, y - 6);
    });

    updateDashboard(detectionsByDirection);
}

/**
 * Update the Live Dashboard with separated direction tabs
 */
function updateDashboard(detectionsByDirection) {
    // Update each direction tab content
    ['left', 'center', 'right'].forEach(direction => {
        const container = document.getElementById(`${direction}-detections`);
        const detections = detectionsByDirection[direction];

        if (detections.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center">ไม่มีวัตถุในพื้นที่นี้</p>';
        } else {
            container.innerHTML = '';
            detections.forEach(det => {
                const div = document.createElement('div');
                div.className = 'detection-item flex justify-between items-center bg-gray-700 px-2 py-1 rounded text-sm mb-1';

                const colorClass = `color-${det.color.toLowerCase()}`;

                div.innerHTML = `
                    <div>
                        <span class="color-badge ${colorClass}">${det.color}</span>
                        <span class="font-medium">${det.class}</span>
                    </div>
                    <span class="text-blue-400 font-bold">${det.confidence}%</span>
                `;

                container.appendChild(div);
            });
        }
    });

    // Show/hide no detections message
    const hasAnyDetections = currentPredictions.length > 0;
    noDetections.classList.toggle('hidden', hasAnyDetections);
}

function getDirectionText(direction) {
    return direction === 'left' ? 'ซ้าย' : direction === 'right' ? 'ขวา' : 'กลาง';
}

function clearCanvas() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}