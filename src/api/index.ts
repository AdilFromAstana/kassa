// Единая точка переключения источника данных.
// Сейчас — localStorage (без бэка). Бэкендер меняет ОДНУ строку на `httpRepository` (см. CONTRACT.md).
// import { localRepository } from './localRepository'
import { httpRepository } from './httpRepository'

// export const repo = localRepository  // ← вернуть для работы без бэка (localStorage)
export const repo = httpRepository  // бэк iiko-pos-backend (Фаза 0): VITE_API_BASE=http://localhost:5080/api

export type { PosRepository, RuntimeSnapshot } from './contract'
export { RUNTIME_KEY } from './contract'
