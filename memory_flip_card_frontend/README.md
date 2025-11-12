# Memory Flip Card Frontend (React)

Playful Ocean Professional themed Memory Flip Card game UI.

## Run

- Node 18+
- Install:
  npm install
- Start:
  npm start
App runs at http://localhost:3000

Backend expected at http://localhost:3001 by default.

## Environment variables

Use CRA-prefixed vars at build time:
- REACT_APP_API_BASE (preferred) or REACT_APP_BACKEND_URL
  Example:
  REACT_APP_API_BASE=http://localhost:3001

Optional:
- REACT_APP_FRONTEND_URL (for backend CORS hints if needed)

## Features

- New/Reset, size 4x4 or 6x6
- Timer, moves, best local score
- Accessible cards (aria, keyboard-friendly)
- Flip animations and responsive grid

## Backend

OpenAPI and endpoints are provided by the FastAPI backend:
- POST /api/game      create session
- GET  /api/game/{id} get session
- POST /api/game/{id}/flip  flip a card
- POST /api/game/{id}/reset reset session

