# Data Agent Frontend

## Summary

Frontend part of Data Agent: React 18 + TypeScript + Vite SPA, served by nginx in Docker.

## Goals

- Keep frontend independent from backend runtime.
- Use `/api` or `VITE_API_URL` for all backend calls.
- Build static assets with `npm run build`.

## Tech Stack

- React 18
- TypeScript
- Vite
- MUI
- nginx for production static hosting and API proxy

## Directories

- `src/` — application code.
- `public/` — static assets and demo datasets.
- `Dockerfile` — production frontend image.
- `nginx.conf` — static hosting and `/api` proxy.

## Coding Rules

- Functional components only.
- Destructure props inline where practical.
- Keep imports at the top of files.
- Do not add backend scripts or Python dependencies here.
- Do not commit `.env`, `.npmrc`, secrets, or build artifacts.
