# HROnboarder — Repository Map

Date: 2026-02-06

## Overview

This repository contains a lightweight onboarding product split across backend and frontend pieces. There are two frontend variants present: `frontend/` (primary app scaffold) and `trial1/` (experimental UI/components and a working onboarding flow). The backend lives under `backend/` and currently exposes small agent code under `backend/app/agents`.

## Top-level layout

- `BRD.md` — business requirements document.
- `backend/` — backend application code (Python-based agents found in `backend/app/agents`).
- `frontend/` — main frontend project (Vite, React). Contains `src/`, `public/`, build and lint configs.
- `trial1/` — separate frontend experiment with a complete onboarding flow, UI primitives, and a mock API.

## Notable locations

- `backend/app/agents/communication.py` — agent code for backend communication or service integrations.
- `frontend/src/` — primary entry (`main.jsx`), root UI (`App.jsx`), styles and assets.
- `trial1/src/` — contains a component library (`components/`), onboarding `steps/`, `pages/`, and `lib/` utilities (`mockApi.js`, `utils.js`).

## Current architecture (high-level)

- Monorepo-style layout: independent frontend(s) and backend living together for easier development and coordination.
- Frontend(s): React + Vite. `trial1/` appears to be a more polished onboarding implementation with small, reusable UI primitives and step components.
- Backend: lightweight Python app (agents) — likely intended to provide APIs, integrations, or background workers that the frontend will call.
- Local dev flow typically uses the Vite dev server for frontend and a separate process for backend agents/services.

## Data & feature flow

- The onboarding UI lives in `trial1/src/steps` (StepWelcome → StepIdentity → StepProfile → StepWorkAuth → StepDocuments → StepOffer → StepReview). The UI talks to a mock API (`trial1/src/lib/mockApi.js`) during local/testing.
- The backend agents (e.g., `communication.py`) are where real external integrations (email, HRIS, document storage) would be implemented and where the frontend should call real endpoints once available.

## Planned / recommended next changes

- Consolidate a single canonical frontend: either migrate `trial1/` improvements into `frontend/` or make `trial1/` the main app.
- Implement REST/GraphQL endpoints in `backend/` that replicate `mockApi.js` functionality so the frontend can switch from mock to real APIs.
- Add authentication and session management (backend + frontend flows).
- Add tests and CI (unit tests for agents and frontend components; end-to-end for onboarding flow).
- Add CONTRIBUTING.md and maintainers/owners metadata (who to contact for each area).

## How to run (developer notes)

- Frontend (Vite):

  - cd into `frontend/` or `trial1/` and run `npm install` then `npm run dev`.

- Backend: inspect `backend/` for run instructions (likely Python virtualenv and a small runner); implement or document run steps if missing.

## TODOs and ownership

- This file is a starting map — owners, API specs, and backend run instructions should be added by the maintainers.

---

Generated and added to repo on 2026-02-06.
