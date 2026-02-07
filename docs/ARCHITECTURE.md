# Architecture Overview

## Stack
- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React (Vite) + REST + WebSocket activity stream
- Orchestration: deterministic agents with optional LLM-assisted email drafting

## Backend Modules
- `backend/app/main.py`
  - API entrypoint, router wiring, websocket endpoint
- `backend/app/routes/`
  - `hr.py`: HR admin endpoints (cases, employees, orchestration trigger)
  - `email.py`: welcome + low-stock email queue endpoints
  - `stock.py`: stock check endpoint
- `backend/app/services/`
  - `orchestrator_service.py`: multi-agent run pipeline and final plan
  - `case_bridge.py`: DB to in-memory case seeding
  - `email_service.py`: email payload generation + outbox logging
- `backend/app/store/case_store.py`
  - in-memory case/session/event store with persisted snapshots (`CaseState`)

## Frontend Modules
- `frontend/src/pages/Onboarding.jsx`
  - Candidate wizard shell + step flow
- `frontend/src/steps/*.jsx`
  - Step-by-step onboarding forms and submit flow
- `frontend/src/pages/HRPage.jsx`
  - HR portal for case management and employee/assets actions
- `frontend/src/components/AgentActivity.jsx`
  - Live websocket event feed
- `frontend/src/lib/mockApi.js`
  - REST and websocket API adapter

## Data Flow (Candidate Submit)
1. Candidate completes steps and submits review.
2. Frontend calls `POST /api/case/{case_id}/submit`.
3. Backend marks case in progress and runs orchestrator:
   - Compliance + Logistics (parallel)
   - HRIS + Workplace + IT (sequenced/idempotent)
4. Backend returns consolidated plan (`ok`, `plan`, `agentOutputs`).
5. Backend queues welcome email as background task.
6. Email is logged to JSONL outbox at `backend/app/logs/emails/outbox.jsonl`.
7. Agent/email events stream to frontend via `ws://.../ws/{case_id}`.

## Persistence
- Relational state: `backend/app/db/hr_automator.db`
- Wizard/agent snapshot state: `case_states` table
- Email outbox: `backend/app/logs/emails/outbox.jsonl`
