# HR Automator (Hackathon) — Project Memory

## Current Goal (24h hackathon)

Deliver a working demo of a 3-agent onboarding system:

- Orchestrator (coordination + conflict detection + final plan)
- Logistics (laptop stock + delivery ETA + seating ETA)
Key demo requirement: real-time agent activity feed visible in UI.
## Repo Layout

- trial1/ — Working onboarding UI (wizard flow + persistence via localStorage + mock API).
- frontend/ — Scaffold Vite app (currently not used).
- backend/ — FastAPI backend powering agents + real-time events.

## Backend (Implemented)

- Web API and WebSocket events:
    - POST /api/case/init create/load a case by applicationNumber
    - POST /api/case/{caseId}/step/{stepKey} save step payload
    - WS /ws/{caseId} streams events and agent outputs
- Demo is deterministic (no LLM dependency) to avoid API failures during judging.

## Changes Log (keep updating)
### 2026-02-06
- Added: backend/app/main.py (FastAPI app, endpoints, websocket)
- Added: backend/app/agents/compliance_agent.py (compliance logic)
- Added: backend/app/services/orchestrator_service.py (parallel run + conflict detection + plan)
- Added: backend/app/tools/logistics_tools.py (deterministic rules)
- Added: backend/requirements.txt, backend/README.md
- Updated: backend/app/agents/communication.py (placeholder helper)


- Replaced trial1/src/lib/mockApi.js to call FastAPI backend (kept export name api)
- Added trial1/src/components/AgentActivity.jsx to show real-time agent events (WebSocket)
- Backend: added POST /api/case/{caseId}/status to support UI status changes
## Milestone 1 – HR-Initiated Onboarding (Completed)
### Summary
Introduced HR-first onboarding where HR admins create cases and generate application codes used by candidates to begin

### Key Capabilities
- HR login and case creation
- Candidate identity resolution via application code

- SQLite used for hackathon via SQLAlchemy ORM
- Qdrant reserved for future semantic use cases (document similarity, negotiation context)

Completed and verified end-to-end.




Added Vite dev proxy for /api and /ws to route frontend requests to the backend cleanly. Implemented HRPage with HR
login, case creation, case listing, and application-code generation to match the intended demo flow.


- Fixed candidate login to validate applicationCode via backend /api/case/init and persist returned case to
  localStorage.
- Hardened application code generation (active + commit).
- HR portal: start date uses date picker; create-case form clears after submit.
### 2026-02-07
- Milestone 1 hardened: idempotent app code; unified frontend API paths; DB-synced statuses; salary shown in offer


- Added: backend/app/agents/it_agent.py — IT provisioning agent (deterministic device bundle, tickets, access groups,
  SLA risks)
- Added: backend/app/tools/it_tools.py — deterministic IT rules
- Added: backend/app/schemas/contracts.py — typed contracts (future-proofing for LLM mode)
- Updated: backend/app/db/models.py — added EmployeeRecord table
- Updated: backend/app/services/orchestrator_service.py — parallel compliance/logistics, then HRIS → IT sequential,
  expanded conflicts, sets READY_FOR_DAY1 when safe
- Updated: backend/app/main.py — added curl-testable endpoints:
    - POST /api/hris/create/{caseId}
    - POST /api/it/provision/{caseId}
- Updated: backend/app/routes/hr.py — HR case listing now includes employeeId

### 2026-02-07 (Curl-first reliability fix)
- Added: backend/app/services/case_bridge.py — DB→case_store bridge (`ensure_case_seeded`) so curl-first endpoints work without requiring `/api/case/init`.
- Updated: backend/app/main.py — all case-scoped endpoints now auto-seed from DB; HRIS/IT endpoints are async and no longer use `run_until_complete`.
- Updated: backend/app/services/orchestrator_service.py — fixed missing HRIS wiring and stabilized conflict detection + plan generation.

## Update Policy

- Every functional change must update this REPO.md with: what changed, files changed, and how to test.
- When releasing fixes to backend API behavior, add a short verification checklist (example commands / sqlite
  queries).

## API Contract (summary)

    - Request: { "applicationCode": "APP-XXXXXX" }
- GET /api/case/{caseId}
    - Response: current case payload from in-memory case_store.
- POST /api/case/{caseId}/step/{stepKey}
    - Request: { payload: {...}, nextStepIndex: number | null }
    - Response: updated case payload.
- POST /api/case/{caseId}/status
    - Request: { status: "STATUS_VALUE" }
    - Response: updated case payload.
- POST /api/onboard/run/{caseId}
    - Request: { notes?: string }
    - Response: orchestration result including HRIS + IT: { plan: ..., agentOutputs: ... }
- POST /api/hris/create/{caseId}
    - Response: { ok: true, hris: { summary, data.employeeId, ... } } (idempotent)
- POST /api/it/provision/{caseId}
    - Response: { ok: true, it: { summary, data.deviceRequest, data.tickets, data.slaRisks } }
- POST /api/hr/cases/{caseId}/generate_code
    - Response: { "applicationCode": "APP-XXXXXX" } (idempotent: returns existing active code if present)

## Status Definitions

- DRAFT — initial state while candidate fills details.
- ON_HOLD_HR — candidate accepted but raised concerns; HR intervention needed.
- DECLINED — candidate declined the offer; onboarding blocked.
- ONBOARDING_IN_PROGRESS — final submit by candidate; orchestrator/agents run to build day-1 plan.
- READY_FOR_DAY1 — HRIS created + IT provision planned and no conflicts detected (Milestone 2).

[2026-02-07] Added: backend/app/services/case_bridge.py — DB→case_store auto-seed bridge for curl-first endpoints

[2026-02-07] Updated: backend/app/main.py — auto-seed for all case endpoints; async HRIS/IT endpoints; removed run_until_complete

[2026-02-07] Updated: backend/app/services/orchestrator_service.py — fixed HRIS wiring and stabilized orchestration/conflicts/plan

### 2026-02-07 (Final Hardening Patch)
- Orchestrator now skips HRIS/IT if outputs already exist (reduces duplicate events).
- Added `POST /api/case/{caseId}/submit` (sets status to ONBOARDING_IN_PROGRESS and runs orchestrator).
- Testing: curl -s -X POST http://localhost:8000/api/case/$CASE/submit \
  -H "Content-Type: application/json" \
  -d '{"notes":"demo submit"}' | python -m json.tool

### 2026-02-07 (Milestone 3: Workplace + Persistence)
- Added: backend/app/agents/workplace_agent.py — Workplace Services agent (equipment bundle + seating assignment)
- Added: backend/app/tools/workplace_tools.py — deterministic workplace equipment + seating plan rules
- Added: backend/app/db/models.py — CaseState table for persisted case_store snapshot
- Updated: backend/app/store/case_store.py — auto-persist case state on step/status/agent updates; restore from DB
- Updated: backend/app/services/case_bridge.py — loads persisted CaseState before DB seeding
- Updated: backend/app/services/orchestrator_service.py — runs Workplace Services, adds output to plan/day1Readiness
- Updated: backend/app/main.py — hardened HRIS/IT endpoints and keeps WS streaming intact
- Testing: curl -s -X POST http://localhost:8000/api/onboard/run/$CASE \
  -H "Content-Type: application/json" \
  -d '{"notes":"milestone3"}' | python -m json.tool

[2026-02-07] Updated: backend/app/services/orchestrator_service.py — status outcome now reflects run result (READY_FOR_DAY1 / AT_RISK) and plan includes decision-ready recommendations

[2026-02-07] Updated: backend/app/tools/workplace_tools.py — workplace bundle now outputs concrete deviceModel for consistent provisioning

[2026-02-07] Updated: backend/app/agents/logistics_agent.py — logistics now validates Workplace-chosen device model (supply/ETA) to avoid device mismatch

[2026-02-07] Updated: backend/app/agents/it_agent.py — IT provisions Workplace-selected deviceModel when present

[2026-02-07] Updated: backend/app/agents/workplace_agent.py — DB-backed idempotency via workplace_assignments

[2026-02-07] Updated: backend/app/db/models.py — added WorkplaceAssignment table

[2026-02-07] Updated: backend/app/main.py — added POST /api/workplace/assign/{caseId} curl-first endpoint and workplace assignment index

## Stability Gate (2026-02-07)

# Health
curl -sS http://127.0.0.1:8000/health | python -m json.tool
# Expect: {"ok": true}

# Create case + generate code + init case
curl -sS -X POST http://127.0.0.1:8000/api/hr/cases \
  -H "Content-Type: application/json" \
  -d '{"candidate_name":"Demo User","role":"Engineer","nationality":"US","work_location":"HQ","start_date":"2026-03-01","salary":"120000"}' | python -m json.tool
# Expect: {"case_id": "CASE-..."}

curl -sS -X POST http://127.0.0.1:8000/api/hr/cases/$CASE_ID/generate_code | python -m json.tool
# Expect: {"applicationCode": "APP-..."}

curl -sS -X POST http://127.0.0.1:8000/api/case/init \
  -H "Content-Type: application/json" \
  -d '{"applicationCode":"APP-XXXXXX"}' | python -m json.tool
# Expect: case payload including status + riskStatus

# Run orchestrator
curl -sS -X POST http://127.0.0.1:8000/api/onboard/run/$CASE_ID \
  -H "Content-Type: application/json" \
  -d '{"notes":"stability-gate"}' | python -m json.tool
# Expect: {"ok": true, "plan": {...}}

# Check status + riskStatus
curl -sS http://127.0.0.1:8000/api/case/$CASE_ID | python -m json.tool
# Expect: "status" lifecycle unchanged (ONBOARDING_IN_PROGRESS or similar)
# Expect: "riskStatus" set to GREEN or AT_RISK

# Assets: persist asset_id + verify
export EMP_ID="..."
curl -sS -X PUT http://127.0.0.1:8000/api/hr/employees/$EMP_ID/assets \
  -H "Content-Type: application/json" \
  -d '{"laptop":{"assigned":true,"model":"Dell Latitude 5440","asset_id":"LAP-DEMO-001"},"seat":{"assigned":true,"location":"HQ-3A-41"}}' | python -m json.tool
# Expect: assets.laptop.asset_id == "LAP-DEMO-001"

curl -sS http://127.0.0.1:8000/api/hr/employees | python -m json.tool
# Expect: assets.laptop.asset_id == "LAP-DEMO-001" on the matching employee

# Orchestrate endpoint single-wrap
curl -sS -X POST http://127.0.0.1:8000/api/hr/cases/$CASE_ID/orchestrate | python -m json.tool
# Expect: top-level keys ok + plan (no nested plan.plan)

[2026-02-07 18:17] Added: backend/app/llm/__init__.py - LLM module package marker
[2026-02-07 18:17] Added: backend/app/llm/client.py - Runpod Ollama client with safe JSON parsing
[2026-02-07 18:17] Added: backend/app/llm/routes.py - LLM curl-first endpoints (/api/llm/ping, /api/llm/json)
[2026-02-07 18:17] Modified: backend/app/main.py - Load backend/.env, register LLM router
[2026-02-07 18:17] Modified: backend/requirements.txt - Add requests and python-dotenv
Testing: curl -sS http://127.0.0.1:8000/api/llm/ping | python -m json.tool
Testing: curl -sS -X POST http://127.0.0.1:8000/api/llm/json -H "Content-Type: application/json" -d '{"prompt":"{\"ok\":true}","mode":"chat"}' | python -m json.tool
[2026-02-07 18:18] Modified: backend/app/main.py - Move dotenv loading to top before LLM imports

[2026-02-07 18:56] Added: backend/app/services/email_service.py - Email outbox writer with idempotent flags and WS emit
[2026-02-07 18:56] Added: backend/app/llm/email_prompts.py - LLM prompt builders for email generation
[2026-02-07 18:56] Added: backend/app/routes/email.py - Email endpoints for welcome + IT low stock
[2026-02-07 18:56] Modified: backend/app/main.py - Register email routes and auto-send welcome on submit
[2026-02-07 18:56] Modified: frontend/src/lib/mockApi.js - Add IT low stock email API call
[2026-02-07 18:56] Modified: frontend/src/pages/HRPage.jsx - Add “Email IT: Low Stock” button and preview
Testing: curl -sS -X POST http://127.0.0.1:8000/api/email/it_low_stock/CASE-XXX -H "Content-Type: application/json" -d '{"it_email":"it@company.com","requested_model":"Standard Laptop","missing_or_low":[]}' | python -m json.tool
[2026-02-07 19:02] Added: backend/app/tools/stock_tools.py - Deterministic IT stock check helper
[2026-02-07 19:02] Added: backend/app/routes/stock.py - POST /api/it/stock_check endpoint
[2026-02-07 19:02] Modified: backend/app/main.py - Registered stock router and updated submit hook to emit email.error on welcome send failure
[2026-02-07 19:02] Modified: frontend/src/lib/mockApi.js - Added sendLowStockEmail and stockCheck API helpers
[2026-02-07 19:02] Modified: frontend/src/pages/HRPage.jsx - Added IT low-stock panel with stock check and email send flow

### 2026-02-07 (Hackathon Patch: DB Persistence + Queued Emails)
- Updated: `backend/app/db/database.py`
  - DB now defaults to file-based SQLite: `sqlite:///backend/app/db/hr_automator.db`
  - `DATABASE_URL` env var is still respected
  - SQLite directory is created automatically before engine init
  - Uses `check_same_thread=False` for SQLite
- Updated: `backend/app/main.py`
  - `POST /api/case/{case_id}/submit` now queues welcome email **after** orchestrator returns OK
  - Queueing uses FastAPI `BackgroundTasks`; onboarding response is not blocked by LLM latency
  - Emits `email.queued` event and never crashes onboarding on email issues
- Updated: `backend/app/routes/email.py`
  - Hardened email routes with top-level try/except + `email.error` event emission
  - `POST /api/email/welcome/{case_id}` accepts optional body `{to_email, requested_model}` and queues background send
  - `POST /api/email/it_low_stock/{case_id}` queues background send and returns immediate preview payload
  - Added shared background helpers for welcome and IT low-stock sends
- Updated: `backend/app/services/email_service.py`
  - Outbox reliability hardening for `backend/app/logs/emails/outbox.jsonl`
  - Always creates directory and file (`mkdir + touch`)
  - Safe append with optional `filelock`, fallback to basic append/file-locking behavior
  - No-throw outbox logger and deterministic fallback emails if LLM fails
  - Step flags persisted in case store (`email_welcome_sent`, `email_it_low_stock_sent`)
- Updated: `backend/app/llm/email_prompts.py`
  - Added strict JSON prompts for welcome + IT low-stock emails
  - Includes personalization fields: candidate, role, location, start date, laptop, seating, case id
- Updated: `backend/app/llm/client.py`
  - DNS host resolution checks are now lazy per-call (no stale import-time host usage)
- Updated: `frontend/src/steps/StepIdentity.jsx`
  - Identity payload now also stores `candidateEmail` and `personalEmail` aliases
- Updated: `frontend/src/steps/StepReview.jsx`
  - Submit path uses `/api/case/{case_id}/submit`
  - Completion card now appends: "A welcome email will be sent to the candidate shortly."
- Updated: `frontend/src/components/AgentActivity.jsx`
  - Friendly UI messages for `email.queued`, `email.sent`, `email.error`
- Updated: `frontend/src/pages/HRPage.jsx`
  - IT low-stock panel now handles queued response state cleanly
- Updated: `frontend/src/lib/mockApi.js`
  - Added `api.submitCase(notes)` helper to call submit endpoint
- Added: `docs/EMAILS.md`
  - Trigger model, outbox format, curl commands, troubleshooting, manual validation flow

DB reset note:
- Delete `backend/app/db/hr_automator.db` to reset persistent local state.

Manual validation commands (do not auto-run):
```bash
# 1) Start backend
cd backend
uvicorn app.main:app --reload

# 2) Ping LLM
curl -sS http://127.0.0.1:8000/api/llm/ping | python -m json.tool

# 3) Create case
curl -sS -X POST http://127.0.0.1:8000/api/hr/cases \
  -H "Content-Type: application/json" \
  -d '{"candidate_name":"Demo User","role":"Engineer","nationality":"US","work_location":"HQ","start_date":"2026-03-01","salary":"120000"}' | python -m json.tool

# 4) Generate code + init session
curl -sS -X POST http://127.0.0.1:8000/api/hr/cases/$CASE_ID/generate_code | python -m json.tool
curl -sS -X POST http://127.0.0.1:8000/api/case/init \
  -H "Content-Type: application/json" \
  -d '{"applicationCode":"APP-XXXXXX"}' | python -m json.tool

# 5) Submit onboarding and queue welcome email after orchestrator
curl -sS -X POST http://127.0.0.1:8000/api/case/$CASE_ID/submit \
  -H "Content-Type: application/json" \
  -d '{"notes":"demo submit"}' | python -m json.tool

# 6) Confirm outbox WELCOME entry
tail -n 20 backend/app/logs/emails/outbox.jsonl

# 7) Stock check + IT low-stock email
curl -sS -X POST http://127.0.0.1:8000/api/it/stock_check \
  -H "Content-Type: application/json" \
  -d '{"requested_model":"qwen2.5 laptop bundle"}' | python -m json.tool

curl -sS -X POST http://127.0.0.1:8000/api/email/it_low_stock/$CASE_ID \
  -H "Content-Type: application/json" \
  -d '{"it_email":"it-servicedesk@company.com","requested_model":"qwen2.5 laptop bundle","missing_or_low":["qwen2.5 laptop bundle","usb-c dock"]}' | python -m json.tool

# 8) Confirm outbox IT_LOW_STOCK entry
tail -n 20 backend/app/logs/emails/outbox.jsonl

# 9) Restart backend and confirm DB persistence
curl -sS http://127.0.0.1:8000/api/hr/cases | python -m json.tool
```

### 2026-02-07 (Diagnostic Repair Pass)
- Fixed: `backend/app/services/email_service.py`
  - Outbox path is now module-anchored (`backend/app/logs/emails/outbox.jsonl`) instead of CWD-relative.
- Fixed: `backend/app/llm/client.py`
  - LLM log directory default is now module-anchored (`backend/app/logs/llm`), with safe relative env handling.
- Fixed: `backend/app/main.py`
  - Missing-case responses for case endpoints now return HTTP `404` instead of `200` error payloads.
  - Orchestrator error output is normalized to HTTP errors in run/submit endpoints.
- Fixed: `frontend/src/steps/StepReview.jsx`
  - Submitted success state now survives page refresh for active onboarding statuses.
- Fixed: `frontend/src/pages/Onboarding.jsx`
  - Back navigation now persists `currentStepIndex` to backend.
- Fixed: `frontend/src/lib/mockApi.js`
  - WebSocket URL now uses `window.location.host` (no hardcoded dev port).
- Improved: `frontend/src/components/AgentActivity.jsx`
  - Email activity labels now differentiate WELCOME vs IT low-stock events.
- Improved: `frontend/src/pages/HRPage.jsx`
  - IT low-stock send UI now handles `skipped` responses correctly.
- Added: `docs/REPO.md`
  - Detailed repair changelog and verification outcomes.
- Added: `docs/ARCHITECTURE.md`
  - Current backend/frontend architecture and data flow.
- Added: `README.md`
  - Quick start and doc index.
