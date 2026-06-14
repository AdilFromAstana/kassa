import type { PosRepository, RuntimeSnapshot } from './contract'
import { RUNTIME_KEY } from './contract'

// Локальная реализация репозитория: localStorage (как сейчас в сторе), обёрнутая в Promise.
// Поведение байт-в-байт совпадает с текущими load*/persist* (тот же JSON.parse/stringify, те же ключи),
// поэтому при переводе стора на этот слой данные и формат не меняются.
export const localRepository: PosRepository = {
  loadConfig<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return Promise.resolve(JSON.parse(raw) as T)
    } catch { /* ignore */ }
    return Promise.resolve(fallback)
  },
  saveConfig(key: string, value: unknown): Promise<void> {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
    return Promise.resolve()
  },
  loadRuntime(): Promise<RuntimeSnapshot> {
    try {
      const raw = localStorage.getItem(RUNTIME_KEY)
      if (raw) return Promise.resolve(JSON.parse(raw) as RuntimeSnapshot)
    } catch { /* ignore */ }
    return Promise.resolve({})
  },
  saveRuntime(snapshot: RuntimeSnapshot): Promise<void> {
    try { localStorage.setItem(RUNTIME_KEY, JSON.stringify(snapshot)) } catch { /* ignore */ }
    return Promise.resolve()
  },
  remove(key: string): Promise<void> {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    return Promise.resolve()
  },
}
