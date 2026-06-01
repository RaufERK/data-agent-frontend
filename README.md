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

Для сборки в инфраструктуре Бизнес-инкубатора нужно использовать корпоративные SberOSC/Nexus registry для базовых образов и npm-зависимостей:

```bash
docker build \
  --build-arg NODE_IMAGE=<sberosc-node-image>:20-alpine \
  --build-arg NGINX_IMAGE=<sberosc-nginx-image>:alpine \
  --build-arg NPM_REGISTRY=<sberosc-npm-registry-url> \
  --secret id=npmrc,src=.npmrc \
  -t data-agent-frontend .
```

Файл `.npmrc` не коммитится и нужен только если корпоративный npm registry требует авторизацию.
