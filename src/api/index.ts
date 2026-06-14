// Единая точка переключения источника данных.
// Сейчас — localStorage (без бэка). Бэкендер меняет ОДНУ строку на `httpRepository` (см. CONTRACT.md).
import { localRepository } from './localRepository'
// import { httpRepository } from './httpRepository'

export const repo = localRepository
// export const repo = httpRepository  // ← переключить, когда бэк готов

export type { PosRepository, RuntimeSnapshot } from './contract'
export { RUNTIME_KEY } from './contract'
