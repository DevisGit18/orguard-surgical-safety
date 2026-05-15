# ORGuard — Surgical Safety Platform

A full-stack clinical web platform digitising the WHO Surgical Safety Checklist with real-time compliance tracking, risk flagging, instrument count verification, and YOLOv8 surgical instrument detection.

## Research Basis

- **PROSPERO 2024 systematic review** (51 studies, 28 countries): global WHO checklist completion at **51.4%**, with sign-out most frequently skipped
- Haynes AB et al. *A Surgical Safety Checklist to Reduce Morbidity and Mortality in a Global Population.* NEJM 2009

## Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js, Tabler Icons
- **AI:** YOLOv8 (Ultralytics) trained on CholecSeg8k, served via Flask

## Features

- Dashboard with live compliance trend, score distribution, phase completion rates
- Checklist creation with patient risk flag detection (anticoagulants, allergies, robotic, anesthesia)
- Filter/search by surgeon, procedure, risk level — paginated
- Click-to-expand modal: phase completion, instrument tracking (count before/after), delete
- Analytics page: 4 Chart.js visualisations + compliance-by-procedure table
- YOLOv8 inference page: upload laparoscopic video → instrument detections + confidence scores
- Colorblind-safe palette (Okabe-Ito), WCAG AA contrast, full ARIA labels, light/dark toggle

## Run Locally

```bash
# MongoDB must be running
cd backend && npm install && npx nodemon index.js

# Open frontend
xdg-open frontend/index.html

# AI server (when model trained)
pip install flask flask-cors ultralytics opencv-python
python detect_server.py
```

## Dataset

CholecSeg8k — Hong et al. 2020. 8,080 annotated laparoscopic frames, 13 instrument/tissue classes.
