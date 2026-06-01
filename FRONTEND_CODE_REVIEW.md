# Рецензия на фронтенд

Код выглядит как сильный MVP с богатой функциональностью, но уже с заметным техническим долгом.

Оценка качества: примерно **6.5/10**.

Для MVP и демо-сценариев это ближе к **7.5/10**, для долгой поддержки в production — около **5.5-6/10**.

## Главные риски

- `src/store/ProjectContext.tsx` стал god-object: сессии, загрузка, качество данных, чат, dashboard, навигация и pipeline живут в одном файле. Это главный источник хрупкости.
- Навигация раздвоена: в `src/App.tsx` есть локальный `currentStep`, а в context есть `activeSection`, `activeSubStep`, `goToPetalStep`. Из-за этого возможны рассинхроны UI.
- В live UI подмешаны demo-данные: `MOCK_DIFFS` используется в `src/pages/DataView.tsx` и context, что может путать реальные backend-результаты с демо-сценарием.
- Есть много `eslint-disable-line react-hooks/exhaustive-deps` в `ProjectContext.tsx`, это риск stale closures и трудноуловимых багов.
- Крупные страницы `src/pages/DataView.tsx` и `src/pages/DashboardPage.tsx` очень большие, их сложно читать, тестировать и безопасно менять.
- Есть legacy/неиспользуемые страницы и зависимости: например `HomePage`, `OCRPage`, `ERDPage`, `DataPage`, `MartPage`, `react-router-dom`, местами `axios`.

## Что хорошо

- Включён строгий TypeScript: `strict`, `noUnusedLocals`, `noUnusedParameters`.
- Есть единый `src/api.ts`, нормальная работа через `/api`, timeout для запросов, `credentials: 'include'`.
- UI функционально богатый: pipeline, чат, dashboard builder, onboarding, квоты, OIDC.
- Есть ручная виртуализация таблицы в `DataView`, что хорошо для больших preview.
- Линтер в IDE сейчас ошибок не показывает.

## Что оптимизировать в первую очередь

1. Разбить `ProjectContext.tsx` на несколько доменных hooks/modules: `session`, `upload`, `quality`, `chat`, `dashboard`, `navigation`.
2. Сделать один source of truth для навигации: либо `currentStep`, либо route/state из context, но не оба сразу.
3. Вынести demo-режим отдельно от production-flow: `MOCK_DIFFS`, fake pipeline, hardcoded chat сценарии.
4. Разделить `DataView.tsx` и `DashboardPage.tsx` на более мелкие компоненты: toolbar, issue panel, table viewport, chart editor, export menu.
5. Добавить lazy loading для тяжёлых страниц: `DataView`, `ModelPage`, `DashboardPage`.
6. Убрать мёртвый код и неиспользуемые зависимости, особенно старые страницы на `axios` и `react-router-dom`, если routing реально не используется.

## Проверка

Файлы проекта при обзоре не менялись.

`ReadLints` ошибок не нашёл.

`npx tsc --noEmit` не прошёл, потому что локальные зависимости не установлены: `npx` попытался скачать сторонний пакет `tsc@2.0.4`, а не использовать TypeScript из проекта.
