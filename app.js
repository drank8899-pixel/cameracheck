/**
 * AI Object Detection Web App
 * Uses TensorFlow.js and COCO-SSD for real-time object detection
 */

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusBar = document.getElementById('status-bar');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const detectionsList = document.getElementById('detections-list');

// State Variables
let stream = null;           // MediaStream object
let model = null;            // TensorFlow.js COCO-SSD model
let isDetecting = false;     // Detection loop flag
let usingFrontCamera = false; // Camera toggle state
let animationId = null;      // RequestAnimationFrame ID

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

/**
 * Main initialization function
 * Loads the AI model and sets up event listeners
 */
async function init() {
    // Set up button event listeners
    startBtn.addEventListener('click', startCamera);
    pauseBtn.addEventListener('click', toggleDetection);
    switchCameraBtn.addEventListener('click', switchCamera);

    // Load the COCO-SSD model
    statusBar.textContent = 'กำลังโหลดโมเดล AI...';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-yellow-600 animate-pulse';

    try {
        // Load TensorFlow.js model
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

/**
 * Start the camera with rear camera preference (mobile-first)
 * Falls back to front camera if rear is unavailable
 */
async function startCamera() {
    try {
        // Try rear camera first (environment), fallback to any camera
        const constraints = {
            video: {
                facingMode: { ideal: "environment" }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        // Update UI state
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        switchCameraBtn.disabled = false;

        // Wait for video to be ready
        video.onloadedmetadata = () => {
            video.play();
            statusBar.textContent = 'กล้องพร้อม - กด "หยุดชั่วคราว" เพื่อเริ่มตรวจจับ';
            statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-green-600';
        };

        // Start detection automatically after camera starts
        startDetection();

    } catch (error) {
        console.error('Error accessing camera:', error);

        // Fallback to front camera if rear fails
        try {
            const frontConstraints = {
                video: {
                    facingMode: "user"
                }
            };
            stream = await navigator.mediaDevices.getUserMedia(frontConstraints);
            video.srcObject = stream;
            usingFrontCamera = true;

            startBtn.disabled = true;
            pauseBtn.disabled = false;
            switchCameraBtn.disabled = false;

            video.onloadedmetadata = () => {
                video.play();
                statusBar.textContent = 'ใช้กล้องหน้าระบบพร้อม';
            };

            startDetection();

        } catch (fallbackError) {
            console.error('Fallback camera also failed:', fallbackError);
            statusBar.textContent = 'ไม่สามารถเข้าถึงกล้องได้';
            statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-red-600';
        }
    }
}

/**
 * Switch between front and rear cameras
 */
async function switchCamera() {
    if (!stream) return;

    // Stop current stream
    stream.getTracks().forEach(track => track.stop());

    // Toggle camera
    const newFacingMode = usingFrontCamera ? "environment" : "user";

    try {
        const constraints = {
            video: { facingMode: newFacingMode }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        usingFrontCamera = !usingFrontCamera;

        statusBar.textContent = `เปลี่ยนเป็นกล้อง${usingFrontCamera ? 'หน้า' : 'หลัง'}แล้ว`;
        setTimeout(() => {
            statusBar.textContent = 'กล้องพร้อม - กด "หยุดชั่วคราว" เพื่อเริ่มตรวจจับ';
        }, 1500);

    } catch (error) {
        console.error('Error switching camera:', error);
        statusBar.textContent = 'ไม่สามารถสลับกล้องได้';
    }
}

/**
 * Start the detection loop
 */
function startDetection() {
    isDetecting = true;
    statusBar.textContent = 'กำลังตรวจจับวัตถุ...';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-blue-600 animate-pulse';

    detectFrame();
}

/**
 * Toggle detection pause/resume
 */
function toggleDetection() {
    if (isDetecting) {
        pauseDetection();
    } else {
        resumeDetection();
    }
}

/**
 * Pause the detection loop
 */
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

/**
 * Resume the detection loop
 */
function resumeDetection() {
    isDetecting = true;
    pauseBtn.textContent = 'หยุดชั่วคราว';
    statusBar.textContent = 'กำลังตรวจจับวัตถุ...';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-blue-600 animate-pulse';
    detectFrame();
}

/**
 * Main detection loop - runs continuously when active
 */
async function detectFrame() {
    if (!isDetecting || !model) return;

    try {
        // Get video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
            animationId = requestAnimationFrame(detectFrame);
            return;
        }

        // Run object detection on current video frame
        const predictions = await model.detect(video);

        // Draw results
        renderDetections(predictions);

    } catch (error) {
        console.error('Detection error:', error);
    }

    // Schedule next frame
    animationId = requestAnimationFrame(detectFrame);
}

/**
 * Render detection results on canvas and update dashboard
 */
function renderDetections(predictions) {
    const ctx = canvas.getContext('2d');
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Set canvas dimensions to match video
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update dashboard
    updateDashboard(predictions);

    // Draw bounding boxes and labels
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const confidence = Math.round(prediction.score * 100);

        // Draw bounding box
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 14px sans-serif';
        const labelText = `${prediction.class} ${confidence}%`;
        const textWidth = ctx.measureText(labelText).width;

        // Label background
        ctx.fillRect(x, y - 22, textWidth + 10, 22);

        // Draw label text
        ctx.fillStyle = '#000';
        ctx.fillText(labelText, x + 5, y - 6);
    });
}

/**
 * Update the Live Dashboard with detected objects
 */
function updateDashboard(predictions) {
    if (predictions.length === 0) {
        detectionsList.innerHTML = '<p class="text-gray-500 text-center">ไม่มีการตรวจจับวัตถุ</p>';
        return;
    }

    // Clear previous detections
    detectionsList.innerHTML = '';

    // Add each detection to dashboard
    predictions.forEach(pred => {
        const confidence = Math.round(pred.score * 100);

        const div = document.createElement('div');
        div.className = 'detection-item flex justify-between items-center bg-gray-700 px-3 py-2 rounded';

        div.innerHTML = `
            <span class="font-medium">${pred.class}</span>
            <span class="text-blue-400 font-bold">${confidence}%</span>
        `;

        detectionsList.appendChild(div);
    });
}

/**
 * Clear the canvas
 */
function clearCanvas() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Stop camera and clean up resources
 */
function stopCamera() {
    isDetecting = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    video.srcObject = null;
    clearCanvas();

    // Reset UI
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    switchCameraBtn.disabled = true;
    pauseBtn.textContent = 'หยุดชั่วคราว';

    detectionsList.innerHTML = '<p class="text-gray-500 text-center">ยังไม่มีการตรวจจับวัตถุ</p>';
    statusBar.textContent = 'ระบบพร้อมทำงาน - กด "เริ่มการทำงาน"';
    statusBar.className = 'mt-2 px-3 py-1 rounded-full text-center text-sm font-medium bg-green-600';
}