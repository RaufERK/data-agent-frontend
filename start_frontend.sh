#!/bin/bash
# Фронтенд: Vite dev-сервер на http://localhost:3001
# /api/* проксируется на http://localhost:8000 (см. vite.config.ts)
cd "$(dirname "$0")"
npm run dev
