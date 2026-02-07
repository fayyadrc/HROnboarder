# HR Automator

FastAPI + React hackathon project for HR onboarding automation with agent orchestration, live activity feed, and queued email simulation.

## Run Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Run Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend dev server proxies `/api` and `/ws` to backend.

## Key Docs
- `docs/ARCHITECTURE.md`
- `docs/EMAILS.md`
- `docs/REPO.md`
- `REPO.md`
