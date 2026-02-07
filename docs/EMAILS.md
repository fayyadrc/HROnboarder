# Emails (Hackathon Demo)

## Overview
All emails are simulated. No SMTP provider is used.

- Outbox log file: `backend/app/logs/emails/outbox.jsonl`
- Welcome email is queued **after** onboarding submit completes orchestrator (`POST /api/case/{case_id}/submit`).
- IT low-stock email is queued from `POST /api/email/it_low_stock/{case_id}`.
- Email generation tries LLM (`RUNPOD_MODEL`, default `qwen2.5:latest`) and falls back to deterministic templates if parsing or generation fails.

## Trigger Behavior
### Welcome
- Triggered automatically after successful orchestrator result from submit endpoint.
- WebSocket events:
  - `email.queued` when queued
  - `email.sent` when logged to outbox
  - `email.error` on failure

### IT Low Stock
- Triggered via endpoint call.
- Endpoint returns quickly with queued status and deterministic preview.
- Background task performs LLM generation + outbox logging.

## Candidate Email Source Priority
Welcome email recipient is resolved in this order:
1. `to_email` from request body (`POST /api/email/welcome/{case_id}`)
2. `case_store.steps` (keys like `email`, `workEmail`, `personalEmail`, `candidateEmail`)
3. Optional DB fallback (`candidate_email` if model/table supports it)

If none found, API returns:
- `400` with `"Candidate email not found. Capture email in wizard or pass to_email."`

## Outbox Record Format
```json
{
  "ts": "2026-02-07T19:00:00.000000Z",
  "to": "candidate@example.com",
  "subject": "Welcome to the team",
  "body": "...",
  "meta": {
    "type": "WELCOME",
    "case_id": "CASE-1234",
    "llm": true,
    "llm_meta": {},
    "model": "qwen2.5:latest"
  }
}
```

## API Endpoints
- `GET /api/llm/ping`
- `POST /api/email/welcome/{case_id}`
- `POST /api/it/stock_check`
- `POST /api/email/it_low_stock/{case_id}`

## Curl Commands
### 1) LLM ping
```bash
curl -sS http://127.0.0.1:8000/api/llm/ping | python -m json.tool
```

### 2) Queue welcome email manually
```bash
curl -sS -X POST http://127.0.0.1:8000/api/email/welcome/$CASE_ID \
  -H "Content-Type: application/json" \
  -d '{"to_email":"candidate@example.com","requested_model":"qwen2.5:latest"}' | python -m json.tool
```

### 3) Stock check
```bash
curl -sS -X POST http://127.0.0.1:8000/api/it/stock_check \
  -H "Content-Type: application/json" \
  -d '{"requested_model":"qwen2.5 laptop bundle"}' | python -m json.tool
```

### 4) Queue IT low-stock email
```bash
curl -sS -X POST http://127.0.0.1:8000/api/email/it_low_stock/$CASE_ID \
  -H "Content-Type: application/json" \
  -d '{"it_email":"it-servicedesk@company.com","requested_model":"qwen2.5 laptop bundle","missing_or_low":["qwen2.5 laptop bundle","usb-c dock"]}' | python -m json.tool
```

## Manual Validation Flow (Do Not Auto-Run)
1. Start backend.
2. Ping LLM.
3. Create case and initialize candidate session.
4. Complete wizard and submit onboarding (`/api/case/{case_id}/submit`).
5. Confirm UI message: `A welcome email will be sent to the candidate shortly.`
6. Confirm outbox has WELCOME entry.
7. Run stock check and IT low-stock email endpoint.
8. Confirm outbox has IT_LOW_STOCK entry.
9. Restart backend and confirm DB-backed cases still exist.

## Troubleshooting
### Candidate email not found
- Ensure identity step stores an `email` field.
- Optionally pass `to_email` in welcome endpoint body.

### LLM returned invalid JSON
- Service automatically falls back to deterministic templates.
- Check LLM parser debug files in `backend/app/logs/llm/`.

### Outbox file missing
- It is created automatically at first send attempt.
- Expected path: `backend/app/logs/emails/outbox.jsonl`.
