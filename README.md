# Memory Match Card Game

Two-container project:
- Frontend (React) at memory_flip_card_frontend
- Backend (FastAPI) at backend

## Run locally

Backend:
- cd memory-match-card-game-222742/backend
- pip install -r requirements.txt
- uvicorn src.api.main:app --host 0.0.0.0 --port 3001

Frontend:
- cd memory-match-card-game-222741/memory_flip_card_frontend
- npm install
- (optional) export REACT_APP_API_BASE=http://localhost:3001
- npm start

Open http://localhost:3000

## Notes

- Frontend auto-derives http://localhost:3001 if env is not set.
- CORS: backend permits localhost dev origins by default.

