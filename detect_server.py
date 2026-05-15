"""
ORGuard — YOLOv8 Surgical Instrument Detection Server
======================================================
Serves inference results from a locally trained YOLOv8 model (CholecSeg8k).

Setup:
    pip install flask flask-cors ultralytics opencv-python

Run:
    python detect_server.py

Expects your trained weights at: runs/detect/train/weights/best.pt
Or set MODEL_PATH env var:        MODEL_PATH=path/to/best.pt python detect_server.py
"""

import os
import cv2
import tempfile
import traceback
from collections import defaultdict

from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)  # allow requests from frontend at file:// or localhost:3000 etc.

# ── Model path ──────────────────────────────────────────────────────────────
MODEL_PATH = os.environ.get(
    'MODEL_PATH',
    os.path.join(os.path.dirname(__file__), 'runs', 'detect', 'train', 'weights', 'best.pt')
)

model = None

def load_model():
    global model
    if model is None:
        print(f'[ORGuard] Loading model from: {MODEL_PATH}')
        model = YOLO(MODEL_PATH)
        print(f'[ORGuard] Model loaded. Classes: {model.names}')
    return model


# ── Health check ─────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': MODEL_PATH})


# ── Detection endpoint ───────────────────────────────────────────────────────
@app.route('/detect', methods=['POST'])
def detect():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    video_file = request.files['video']
    if video_file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Save upload to temp file
    suffix = os.path.splitext(video_file.filename)[-1] or '.mp4'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        video_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        m = load_model()

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return jsonify({'error': 'Could not open video file'}), 400

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps          = cap.get(cv2.CAP_PROP_FPS) or 25

        # Sample every N frames to keep response fast
        # Aim for ~200 sampled frames regardless of video length
        sample_every = max(1, total_frames // 200)

        detections = []   # [{label, confidence, frame}]
        summary    = defaultdict(int)

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every == 0:
                results = m(frame, verbose=False)[0]
                for box in results.boxes:
                    cls_id     = int(box.cls[0])
                    label      = m.names[cls_id]
                    confidence = float(box.conf[0])
                    if confidence >= 0.25:   # confidence threshold
                        detections.append({
                            'label':      label,
                            'confidence': round(confidence, 4),
                            'frame':      frame_idx,
                            'time_s':     round(frame_idx / fps, 2),
                        })
                        summary[label] += 1

            frame_idx += 1

        cap.release()

        return jsonify({
            'detections':    detections,
            'summary':       dict(summary),
            'frames_total':  total_frames,
            'frames_sampled': frame_idx // sample_every,
            'fps':           round(fps, 2),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

    finally:
        os.unlink(tmp_path)


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('[ORGuard] Starting detection server on http://localhost:5001')
    print(f'[ORGuard] Model path: {MODEL_PATH}')
    app.run(host='0.0.0.0', port=5001, debug=False)
