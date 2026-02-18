# Moodify (Spotify Mood Playlist Generator)

Tech stack:
- Frontend: React + Vite + Tailwind CSS
- API: Spotify Web API
- Runtime options:
  - Local: Node.js + Express (`backend/`)
  - Vercel: Serverless API routes (`frontend/api/`)

## Deploy to Vercel (single project)

1. Push this repo to GitHub.
2. In Vercel, import the repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variables in Vercel Project Settings:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REDIRECT_URI` = `https://YOUR-VERCEL-DOMAIN/api/auth/callback`
   - `FRONTEND_URL` = `https://YOUR-VERCEL-DOMAIN`
   - `COOKIE_SECRET` = random long string
   - `NODE_ENV` = `production`
5. In Spotify Developer Dashboard, add redirect URI:
   - `https://YOUR-VERCEL-DOMAIN/api/auth/callback`
6. Deploy.

Frontend calls same-origin `/api/*` routes in Vercel.

## Local development

### 1) Create Spotify app

In Spotify Developer Dashboard, add redirect URI:
- `http://127.0.0.1:5000/auth/callback`

### 2) Configure env files

Backend:
1. Copy `backend/.env.example` to `backend/.env`
2. Fill in:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
3. Use:
   - `FRONTEND_URL=http://127.0.0.1:5173`
   - `SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/auth/callback`

Frontend:
1. Copy `frontend/.env.example` to `frontend/.env`
2. Use:
   - `VITE_API_BASE_URL=http://127.0.0.1:5000`

### 3) Install dependencies

From project root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 4) Run

```bash
npm run dev
```

Frontend: `http://127.0.0.1:5173`
Backend: `http://127.0.0.1:5000`

## Available moods

- happy
- chill
- energetic
- focused
- melancholic

Tune mood parameters:
- Local backend: `backend/src/server.js`
- Vercel API: `frontend/api/_lib/spotify.js`