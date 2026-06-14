import type { PosRepository, RuntimeSnapshot } from './contract'
import { RUNTIME_KEY } from './contract'

// ЗАГОТОВКА для бэкендера. Когда появится сервер:
//  1) поднять REST по src/api/CONTRACT.md;
//  2) заполнить вызовы fetch ниже (убрать throw);
//  3) в src/api/index.ts переключить `export const repo = httpRepository`.
// Сигнатуры совпадают с LocalRepository — UI и стор менять не нужно.
const BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api'

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch { return fallback }
}
async function putJson(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${BASE}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch { /* TODO: очередь оффлайна */ }
}

export const httpRepository: PosRepository = {
  // GET /api/config/:key → значение; нет → fallback (сид)
  loadConfig: <T>(key: string, fallback: T) => getJson<T>(`/config/${encodeURIComponent(key)}`, fallback),
  // PUT /api/config/:key
  saveConfig: (key: string, value: unknown) => putJson(`/config/${encodeURIComponent(key)}`, value),
  // GET /api/runtime → оперативный слой (смена/заказы/…)
  loadRuntime: () => getJson<RuntimeSnapshot>(`/runtime`, {}),
  // PUT /api/runtime
  saveRuntime: (snapshot: RuntimeSnapshot) => putJson(`/runtime`, snapshot),
  // DELETE /api/config/:key
  remove: async (key: string) => {
    try { await fetch(`${BASE}/config/${encodeURIComponent(key)}`, { method: 'DELETE' }) } catch { /* ignore */ }
  },
}

export { RUNTIME_KEY }
