import urllib.request
import os

MODEL_URL = "https://tfhub.dev/tensorflow/lite-model/ssd_mobilenet_v2/1/metadata/2?lite-format=tflite"
MODEL_PATH = "ssd_mobilenet_v2_coco.tflite"

def download_model():
    if os.path.exists(MODEL_PATH):
        print(f"Model already exists: {MODEL_PATH}")
        return

    print("Downloading TensorFlow Lite model (this may take a moment)...")
    try:
        urllib.request.urlretrieve(
            "https://storage.googleapis.com/download.tensorflow.org/models/tflite/ssd_mobilenet_v2/model.tflite",
            MODEL_PATH
        )
        print(f"Model downloaded successfully: {MODEL_PATH}")
    except Exception as e:
        print(f"Download failed: {e}")
        print("You can manually download the model later.")

if __name__ == "__main__":
    download_model()