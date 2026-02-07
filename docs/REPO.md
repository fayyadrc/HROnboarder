# HR Automator Repair Log

## Date
- 2026-02-07

## Scope
- Path reliability for backend logs/outbox
- Backend HTTP error/status consistency
- Frontend refresh resiliency for submit state
- WebSocket connection robustness for activity feed

## Changes Applied
- Updated `backend/app/services/email_service.py`
  - Switched outbox path from CWD-relative to module-anchored path:
    - `backend/app/logs/emails/outbox.jsonl`
- Updated `backend/app/llm/client.py`
  - Switched LLM log directory to module-anchored path by default:
    - `backend/app/logs/llm`
  - Relative `LLM_LOG_DIR` env values now resolve from `backend/app`
- Updated `backend/app/main.py`
  - Standardized missing-case handling to proper `404` errors for:
    - `GET /api/case/{case_id}`
    - `POST /api/case/{case_id}/step/{step_key}`
    - `POST /api/case/{case_id}/status`
  - Added orchestrator error normalization in run/submit endpoints
- Updated `frontend/src/steps/StepReview.jsx`
  - Submit success state now survives refresh for active onboarding statuses
- Updated `frontend/src/pages/Onboarding.jsx`
  - Back navigation now persists `currentStepIndex` via API
- Updated `frontend/src/lib/mockApi.js`
  - WebSocket URL now uses `window.location.host` (no hardcoded port)
- Updated `frontend/src/components/AgentActivity.jsx`
  - Correct message labeling for welcome vs IT low-stock email events
- Updated `frontend/src/pages/HRPage.jsx`
  - IT low-stock panel now handles `skipped` responses as non-failures

## Verification Performed
- Syntax:
  - `cd backend && python -m py_compile app/main.py app/services/email_service.py app/llm/client.py`
- Frontend build:
  - `cd frontend && npm run build`
- Runtime checks:
  - Created case and queued IT low-stock email
  - Verified outbox entry written to `backend/app/logs/emails/outbox.jsonl`
  - Verified missing-case endpoints return `404` with JSON detail
  - Verified submit response includes `ok`, `plan`, and welcome-email message

## Notes
- Legacy logs remain at `backend/backend/app/logs/...` from prior buggy path behavior.
- New writes now use `backend/app/logs/...`.
