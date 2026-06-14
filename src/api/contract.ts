// ───────── Слой данных (репозиторий) — единый шов между UI/стором и хранилищем ─────────
// Сегодня данные лежат в localStorage (LocalRepository). Завтра бэкендер реализует HttpRepository
// (fetch к REST) и переключит активную реализацию в `index.ts` — UI и стор не меняются.
// Контракт async с первого дня: локальная реализация резолвит мгновенно, сетевая — после ответа сервера.

// Оперативный слой (смена/заказы/банкеты/документы…) — сохраняется одним снимком (ключ iiko-runtime).
export type RuntimeSnapshot = Record<string, unknown>

export interface PosRepository {
  // прочитать конфиг-значение по ключу; при отсутствии вернуть fallback (сид)
  loadConfig<T>(key: string, fallback: T): Promise<T>
  // сохранить конфиг-значение по ключу
  saveConfig(key: string, value: unknown): Promise<void>
  // прочитать оперативный слой (смена/заказы/…) одним объектом
  loadRuntime(): Promise<RuntimeSnapshot>
  // сохранить оперативный слой
  saveRuntime(snapshot: RuntimeSnapshot): Promise<void>
  // удалить ключ (сброс)
  remove(key: string): Promise<void>
}

// Ключ оперативного слоя (исторически один JSON в localStorage).
export const RUNTIME_KEY = 'iiko-runtime'
