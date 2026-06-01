# Data Agent Frontend

React/Vite frontend для Data Agent. В production собирается в статические файлы и раздается через nginx.

## Локальный запуск

```bash
npm ci
npm run dev
```

Frontend будет доступен на `http://localhost:3001`.

## Переменные окружения

Скопируйте пример:

```bash
cp .env.example .env
```

По умолчанию frontend ходит в backend через `/api`:

```env
VITE_API_URL=/api
```

## Docker

```bash
docker build -t data-agent-frontend .
docker run --rm -p 5000:80 data-agent-frontend
```

В общем запуске nginx проксирует `/api/*` в backend-сервис.
