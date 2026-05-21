import numpy as np
import cv2
from flask import Flask, request, jsonify, send_from_directory
import tensorflow as tf
from PIL import Image
import io
import base64
import threading
import time

app = Flask(__name__)

# Load pre-trained object detection model (MobileNet SSD for efficiency)
MODEL_PATH = 'ssd_mobilenet_v2_coco.tflite'

def load_model():
    try:
        interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
        interpreter.allocate_tensors()
        return interpreter
    except:
        print("Model not found. Using fallback detection.")
        return None

interpreter = load_model()
input_details = interpreter.get_input_details() if interpreter else None
output_details = interpreter.get_output_details() if interpreter else None

# COCO class labels
CLASS_LABELS = {
    0: 'person', 1: 'bicycle', 2: 'car', 3: 'motorcycle', 4: 'airplane',
    5: 'bus', 6: 'train', 7: 'truck', 8: 'boat', 9: 'traffic light',
    10: 'fire hydrant', 11: 'street sign', 13: 'stop sign', 14: 'parking meter',
    15: 'bench', 16: 'bird', 17: 'cat', 18: 'dog', 19: 'horse', 20: 'sheep',
    21: 'cow', 22: 'elephant', 23: 'bear', 24: 'zebra', 25: 'giraffe',
    26: 'hat', 27: 'backpack', 28: 'umbrella', 29: 'shoe', 30: 'eye glasses',
    31: 'handbag', 32: 'tie', 33: 'suitcase', 34: 'frisbee', 35: 'skis',
    36: 'snowboard', 37: 'sports ball', 38: 'kite', 39: 'baseball bat',
    40: 'baseball glove', 41: 'skateboard', 42: 'surfboard', 43: 'tennis racket',
    44: 'bottle', 45: 'plate', 46: 'wine glass', 47: 'cup', 48: 'fork',
    49: 'knife', 50: 'spoon', 51: 'bowl', 52: 'banana', 53: 'apple',
    54: 'sandwich', 55: 'orange', 56: 'broccoli', 57: 'carrot', 58: 'hot dog',
    59: 'pizza', 60: 'donut', 61: 'cake', 62: 'chair', 63: 'couch',
    64: 'potted plant', 65: 'bed', 66: 'mirror', 67: 'dining table',
    68: 'window', 69: 'desk', 70: 'toilet', 71: 'door', 72: 'tv',
    73: 'laptop', 74: 'mouse', 75: 'remote', 76: 'keyboard', 77: 'phone',
    78: 'microwave', 79: 'oven', 80: 'toaster', 81: 'sink', 82: 'refrigerator',
    83: 'blender', 84: 'book', 85: 'clock', 86: 'vase', 87: 'scissors',
    88: 'teddy bear', 89: 'hair drier', 90: 'toothbrush'
}

def preprocess_image(image):
    input_shape = input_details[0]['shape']
    image_resized = cv2.resize(image, (input_shape[2], input_shape[1]))
    image_normalized = image_resized / 255.0
    return np.expand_dims(image_normalized, axis=0).astype(np.float32)

def run_detection(image):
    if interpreter is None:
        return mock_detection(image)

    input_tensor = preprocess_image(image)
    interpreter.set_tensor(input_details[0]['index'], input_tensor)
    interpreter.invoke()

    boxes = interpreter.get_tensor(output_details[0]['index'])[0]
    classes = interpreter.get_tensor(output_details[1]['index'])[0]
    scores = interpreter.get_tensor(output_details[2]['index'])[0]

    detections = []
    for i in range(len(scores)):
        if scores[i] > 0.5:
            label_name = CLASS_LABELS.get(int(classes[i]), f"class_{int(classes[i])}")
            detections.append({
                'label': label_name,
                'confidence': float(scores[i]),
                'box': [float(x) for x in boxes[i]]
            })
    return detections

def mock_detection(image):
    h, w = image.shape[:2]
    detections = [
        {'label': 'person', 'confidence': 0.92, 'box': [0.3, 0.2, 0.5, 0.8]},
        {'label': 'phone', 'confidence': 0.78, 'box': [0.6, 0.4, 0.8, 0.6]}
    ]
    return detections

def draw_boxes(image, detections):
    result = image.copy()
    h, w = result.shape[:2]
    for det in detections:
        box = det['box']
        x1 = int(box[1] * w)
        y1 = int(box[0] * h)
        x2 = int(box[3] * w)
        y2 = int(box[2] * h)
        cv2.rectangle(result, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"{det['label']} {det['confidence']:.2f}"
        cv2.putText(result, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    return result

def image_to_base64(image):
    _, buffer = cv2.imencode('.jpg', image)
    return base64.b64encode(buffer).decode('utf-8')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Global variables for real-time detection
latest_detections = []
detection_lock = threading.Lock()

@app.route('/detect_realtime', methods=['POST'])
def detect_realtime():
    global latest_detections
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    image = Image.open(io.BytesIO(file.read()))
    image_array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    detections = run_detection(image_array)

    with detection_lock:
        latest_detections = detections

    return jsonify({
        'detections': detections
    })

@app.route('/latest_detections')
def get_latest_detections():
    global latest_detections
    with detection_lock:
        return jsonify({'detections': latest_detections})

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    image = Image.open(io.BytesIO(file.read()))
    image_array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    detections = run_detection(image_array)
    result_image = draw_boxes(image_array, detections)
    image_base64 = image_to_base64(result_image)

    return jsonify({
        'detections': detections,
        'image': f'data:image/jpeg;base64,{image_base64}'
    })

if __name__ == '__main__':
    print("Starting object detection server...")
    print("Download the model from: https://tfhub.dev/tensorflow/lite-model/ssd_mobilenet_v2/1/metadata/2")
    app.run(host='0.0.0.0', port=5000, debug=True)