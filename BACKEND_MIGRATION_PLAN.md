# BACKEND_MIGRATION_PLAN.md — слой данных под будущий бэкенд (блок C)

Цель: спрятать персистентность за единый async-шов, чтобы подключение реального бэка свелось к замене
ОДНОЙ реализации, не трогая UI/логику. Контракт и эндпоинты — в `src/api/CONTRACT.md`.

## Архитектура
```
Экраны → usePos (zustand, UI-state + действия) → repo (src/api) → localStorage | (позже) fetch
```
- `src/api/contract.ts` — интерфейс `PosRepository` (async): `loadConfig/saveConfig/loadRuntime/saveRuntime/remove`.
- `src/api/localRepository.ts` — текущая реализация (localStorage, Promise-обёртка, те же ключи/формат).
- `src/api/httpRepository.ts` — ЗАГОТОВКА для бэкендера (fetch к REST; переключается в `index.ts`).
- `src/api/index.ts` — единственная точка переключения: `export const repo = localRepository`.

## Принципы
- Не ломать текущее: localRepository пишет в те же ключи тем же JSON → данные/формат не меняются.
- Async с первого дня: локально промисы резолвят мгновенно (sync-init сохраняется), сетевой бэк — после ответа.
- Инкрементально, каждый шаг — `build` зелёный + проверка.

## Статус
- **C1 ✅** слой создан (`src/api/*` + CONTRACT.md), НЕ подключён к стору = нулевой риск.
  Проверено round-trip-смоком (6/6 PASS): fallback-сид, save→load объект/массив, runtime round-trip, remove, пустой runtime→{}.
- **C2 (частично) ✅** запись оперативного слоя (`persistRuntime` → `repo.saveRuntime`) идёт через слой. Build зелёный, boot 200, поведение идентично (тот же ключ `iiko-runtime`).
- **C3 ✅** все записи конфиг-модулей идут через `repo.saveConfig` (33 точки: `persist*` + инлайн в действиях, те же ключи/формат). Исключение — `iiko-demo-auto` (raw-строка '0'/'1', не JSON — оставлен как есть). Build зелёный, boot 200.
- **C4 ⬜** асинхронная гидратация при старте (`repo.loadRuntime/loadConfig` + флаг `ready`/сплэш) — нужно ТОЛЬКО при переезде на http; сейчас чтение остаётся синхронным.

## Как переключить на бэкенд (для бэкендера)
1. Поднять REST по `src/api/CONTRACT.md`.
2. Заполнить `fetch` в `httpRepository.ts`.
3. В `index.ts`: `export const repo = httpRepository`.
4. Реализовать C4 (async-гидратацию со сплэшем).

## Как прогнать проверку слоя (round-trip)
Смок-скрипт дёргает методы репозитория с in-memory localStorage и проверяет, что данные возвращаются:
`esbuild <smoke>.ts --bundle --platform=node --format=esm --outfile=/tmp/v.mjs && node /tmp/v.mjs`
(см. историю; полифилл localStorage + save/load/remove ассерты).
