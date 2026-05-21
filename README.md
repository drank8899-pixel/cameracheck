# ระบบตรวจจับวัตถุจากกล้องมือถือ

เว็บแอปเปิดกล้องหลังมือถือและตรวจจับวัตถุ

## ไฟล์ที่สร้าง
- `index.html` - หน้าเว็บหลัก
- `style.css` - สไตล์ CSS
- `app.js` - JavaScript สำหรับกล้องและ API
- `detector.py` - Python backend สำหรับ Object Detection
- `requirements.txt` - แพ็กเกจ Python ที่ต้องใช้
- `download_model.py` - สคริปต์ดาวน์โหลดโมเดล

## การติดตั้ง

```bash
# ติดตั้งแพ็กเกจ
pip install -r requirements.txt

# ดาวน์โหลดโมเดล (เลือก 1 วิธี)
python download_model.py

# หรือดาวน์โหลดด้วยตนเองจาก:
# https://storage.googleapis.com/download.tensorflow.org/models/tflite/ssd_mobilenet_v2/model.tflite
```

## การใช้งาน

```bash
# เริ่มเซิร์ฟเวอร์
python detector.py
```

เปิดเว็บเบราว์เซอร์ไปที่ http://localhost:5000

## วิธีใช้งาน
1. กดปุ่ม "เปิดกล้อง" เพื่อเปิดกล้องหลังมือถือ
2. กดปุ่ม "ถ่ายภาพตรวจจับ" เพื่อถ่ายภาพและตรวจจับวัตถุ
3. ดูผลการตรวจจับที่แสดงชื่อวัตถุและความมั่นใจ

## หมายเหตุ
- ต้องเปิดใช้งาน HTTPS หรือ localhost เพื่อเข้าถึงกล้อง
- หากไม่มีโมเดล จะใช้โหมดจำลอง (mock detection)