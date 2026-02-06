# HR Automator Backend (FastAPI)

## Run locally
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

Endpoints

GET /health

POST /api/case/init

GET /api/case/{caseId}

POST /api/case/{caseId}/step/{stepKey}

POST /api/onboard/run/{caseId}

WS /ws/{caseId} (real-time agent events)
