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
