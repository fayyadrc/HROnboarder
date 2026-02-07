# Render Deployment Instructions

## 1. Automated Setup (Recommended)

I have updated your `render.yaml` file to define **TWO separate services**:

1.  **Backend** (`hronboarder-backend`): Uses `backend/Dockerfile`
2.  **Frontend** (`hronboarder-frontend`): Uses `frontend/Dockerfile`

**Steps:**

1.  Go to your Render Dashboard.
2.  Click **New +** > **Blueprint**.
3.  Connect your repository (`fayyadrc/HROnboarder`).
4.  Render will detect the `render.yaml` file and automatically create both services with the correct settings.

## 2. Manual Setup (Alternative)

If you prefer to create services manually:

### Backend Service

- Create a new **Web Service**.
- Connect repo.
- **Runtime**: Docker.
- **Root Directory**: `backend` (Important!)
- **Environment Variables**: Same as listed in `render.yaml`.

### Frontend Service

- Create a new **Web Service**.
- Connect repo.
- **Runtime**: Docker.
- **Root Directory**: `frontend` (Important!)
- **Environment Variables**: `VITE_API_BASE` pointing to your backend URL.
