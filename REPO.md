# HR Automator (Hackathon) — Project Memory

## Current Goal (24h hackathon)
Deliver a working demo of a **3-agent onboarding system**:
- **Orchestrator** (coordination + conflict detection + final plan)
- **Compliance** (required docs + visa timeline risk flags)
- **Logistics** (laptop stock + delivery ETA + seating ETA)

Key demo requirement: **real-time agent activity feed** visible in UI.

## Repo Layout
- `trial1/` — Working onboarding UI (wizard flow + persistence via localStorage + mock API).
- `frontend/` — Scaffold Vite app (currently not used).
- `backend/` — FastAPI backend powering agents + real-time events.

## Backend (Implemented)
- Web API and WebSocket events:
  - `POST /api/case/init` create/load a case by applicationNumber
  - `GET /api/case/{caseId}`
  - `POST /api/case/{caseId}/step/{stepKey}` save step payload
  - `POST /api/onboard/run/{caseId}` runs orchestrator (compliance + logistics parallel)
  - `WS /ws/{caseId}` streams events and agent outputs

- Demo is **deterministic** (no LLM dependency) to avoid API failures during judging.

## Changes Log (keep updating)
### 2026-02-06
- Added: `backend/app/main.py` (FastAPI app, endpoints, websocket)
- Added: `backend/app/store/case_store.py` (in-memory case store + event bus)
- Added: `backend/app/agents/base_agent.py` (agent base + result schema)
- Added: `backend/app/agents/compliance_agent.py` (compliance logic)
- Added: `backend/app/agents/logistics_agent.py` (logistics logic)
- Added: `backend/app/services/orchestrator_service.py` (parallel run + conflict detection + plan)
- Added: `backend/app/tools/compliance_tools.py` (deterministic rules)
- Added: `backend/app/tools/logistics_tools.py` (deterministic rules)
- Added: `backend/requirements.txt`, `backend/README.md`
- Updated: `backend/app/agents/communication.py` (placeholder helper)

### 2026-02-06 (UI Integration)
- Fixed broken `trial1` files: `App.jsx`, `WizardShell.jsx`, `StepReview.jsx`
- Replaced `trial1/src/lib/mockApi.js` to call FastAPI backend (kept export name `api`)
- Added `trial1/src/components/AgentActivity.jsx` to show real-time agent events (WebSocket)
- Backend: added `POST /api/case/{caseId}/status` to support UI status changes

## Milestone 1 – HR-Initiated Onboarding (Completed)

### Summary
Introduced HR-first onboarding where HR admins create cases and generate application codes used by candidates to begin onboarding.

### Key Capabilities
- HR login and case creation
- Application code generation
- Candidate identity resolution via application code
- SQLite-backed persistence using SQLAlchemy

### Storage Architecture
- SQLite used for hackathon via SQLAlchemy ORM
- PostgreSQL planned for production (no code changes required)
- Qdrant reserved for future semantic use cases (document similarity, negotiation context)

### Status
Completed and verified end-to-end.

### 2026-02-06 (HR Routing Cleanup)
- Removed import-time DB initialization from `backend/app/routes/hr.py`
- Moved HR user seeding and schema creation to FastAPI startup in `backend/app/main.py`

### 2026-02-06 (HR Case Init Bridge)
- Updated `/api/case/init` to seed `case_store` from HR DB via application code

### 2026-02-06 (Vite Proxy + HR Portal UI)
Added Vite dev proxy for /api and /ws to route frontend requests to the backend cleanly. Implemented HRPage with HR login, case creation, case listing, and application-code generation to match the intended demo flow.

### 2026-02-06 (Milestone 1 Stabilization)
- Fixed candidate login to validate applicationCode via backend /api/case/init and persist returned case to localStorage.
- Hardened application code generation (active + commit).
- HR portal: start date uses date picker; create-case form clears after submit.

### 2026-02-07
- Milestone 1 hardened: idempotent app code; unified frontend API paths; DB-synced statuses; salary shown in offer step.

## Update Policy

- Every functional change must update this `REPO.md` with: what changed, files changed, and how to test.
- When releasing fixes to backend API behavior, add a short verification checklist (example commands / sqlite queries).

## API Contract (summary)

- POST `/api/case/init`
  - Request: `{ "applicationCode": "APP-XXXXXX" }`
  - Response: Full case payload seeded into case_store with `caseId`, `applicationNumber`, and `seed.compensation.salary`.

- GET `/api/case/{caseId}`
  - Response: current case payload from in-memory case_store.

- POST `/api/case/{caseId}/step/{stepKey}`
  - Request: `{ payload: {...}, nextStepIndex: number | null }`
  - Response: updated case payload.

- POST `/api/case/{caseId}/status`
  - Request: `{ status: "STATUS_VALUE" }`
  - Response: updated case payload.

- POST `/api/onboard/run/{caseId}`
  - Request: `{ notes?: string }`
  - Response: orchestration result: `{ plan: ..., agentSummaries: ..., overallStatus: ... }`

- POST `/api/hr/cases/{caseId}/generate_code`
  - Response: `{ "applicationCode": "APP-XXXXXX" }` (idempotent: returns existing active code if present)

## Status Definitions

- `DRAFT` — initial state while candidate fills details.
- `ON_HOLD_HR` — candidate accepted but raised concerns; HR intervention needed.
- `DECLINED` — candidate declined the offer; onboarding blocked.
- `ONBOARDING_IN_PROGRESS` — final submit by candidate; orchestrator/agents run to build day-1 plan.

