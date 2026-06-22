// Активная точка (ТП) для офисных вызовов с pointId в пути. Переключатель точки в шапке офиса меняет её.
// Касса использует точку из своего JWT; для офиса значение по умолчанию — демо-точка из env.
const env = (import.meta as unknown as { env?: Record<string, string> }).env
const DEFAULT = env?.VITE_TRADE_POINT_ID ?? '00000000-0000-0000-0000-000000000001'
const KEY = 'iiko-active-tp'

let active = ((): string => { try { return localStorage.getItem(KEY) || DEFAULT } catch { return DEFAULT } })()

export const getTradePoint = (): string => active
export const setActivePoint = (id: string) => {
  active = id
  try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
}
