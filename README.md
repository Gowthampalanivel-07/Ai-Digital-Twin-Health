# AI Digital Twin for Health Prediction (MVP)

Starter implementation with:
- `backend`: FastAPI service for manual ingestion, current risk scoring, and what-if simulation.
- `frontend`: React + Vite UI for viewing risk and testing lifestyle scenarios.

## 1) Run backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000`

## 2) Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173`

## API endpoints
- `GET /health`
- `POST /ingest/manual`
- `GET /users/{user_id}/risk`
- `POST /users/{user_id}/simulate`

## Next steps
- Add PostgreSQL + InfluxDB integration
- Replace rule-based risk logic with trained ML models
- Add wearable connectors (Fitbit/Apple Health)
- Add D3 risk trend chart and avatar visualization
