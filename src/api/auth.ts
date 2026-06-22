// Клиент авторизации (Level 2): реальный вход в бэкенд iiko-pos-backend → JWT.
// Токен хранится в localStorage и подставляется в Authorization всеми запросами (httpRepository).
const BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api'
// id точки (ТП) для входа кассы по PIN/карте. По умолчанию — демо-точка сети «Mumtaz».
const TRADE_POINT = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TRADE_POINT_ID
  ?? '00000000-0000-0000-0000-000000000001'

const TOKEN_KEY = 'iiko-token'
const AUTH_KEY = 'iiko-auth'

export interface AuthInfo {
  kind: 'pos' | 'office' | 'platform'
  token: string
  tenantId?: string
  tradePointId?: string
  employee?: string
  role?: string
  positions?: string[]
  rights?: string[]
}

let current: AuthInfo | null = (() => {
  try { const raw = localStorage.getItem(AUTH_KEY); return raw ? (JSON.parse(raw) as AuthInfo) : null } catch { return null }
})()

export const getToken = (): string | null => current?.token ?? null
export const getAuth = (): AuthInfo | null => current
export const isAuthed = (): boolean => !!current?.token

function persist(a: AuthInfo | null) {
  current = a
  try {
    if (a) { localStorage.setItem(TOKEN_KEY, a.token); localStorage.setItem(AUTH_KEY, JSON.stringify(a)) }
    else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(AUTH_KEY) }
  } catch { /* ignore */ }
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch { return null }
}

// Вход кассы по PIN (в контексте точки). Возвращает AuthInfo или null (неверный PIN).
export async function loginByPin(pin: string): Promise<AuthInfo | null> {
  const r = await post<Omit<AuthInfo, 'kind'>>('/auth/pin', { tradePointId: TRADE_POINT, pin })
  if (!r?.token) return null
  const a: AuthInfo = { kind: 'pos', tradePointId: TRADE_POINT, ...r }
  persist(a); return a
}

export async function loginByCard(card: string): Promise<AuthInfo | null> {
  const r = await post<Omit<AuthInfo, 'kind'>>('/auth/card', { tradePointId: TRADE_POINT, card })
  if (!r?.token) return null
  const a: AuthInfo = { kind: 'pos', tradePointId: TRADE_POINT, ...r }
  persist(a); return a
}

// Вход офиса по email/паролю.
export async function loginOffice(email: string, password: string): Promise<AuthInfo | null> {
  const r = await post<Omit<AuthInfo, 'kind'>>('/auth/login', { email, password })
  if (!r?.token) return null
  const a: AuthInfo = { kind: 'office', ...r }
  persist(a); return a
}

// Вход платформенного админа (реестр клиентов-сетей).
export async function loginPlatform(email: string, password: string): Promise<AuthInfo | null> {
  const r = await post<{ token: string }>('/auth/platform-login', { email, password })
  if (!r?.token) return null
  const a: AuthInfo = { kind: 'platform', token: r.token, role: 'platform' }
  persist(a); return a
}

// Self-serve регистрация новой сети + владельца → сразу office-токен.
export async function registerNetwork(networkName: string, email: string, password: string, bin: string): Promise<AuthInfo | null> {
  const r = await post<Omit<AuthInfo, 'kind'>>('/auth/register', { networkName, email, password, bin })
  if (!r?.token) return null
  const a: AuthInfo = { kind: 'office', ...r }
  persist(a); return a
}

// Установить auth вручную (например, после «войти как клиент» — токен уже выдан платформой).
export function setAuth(a: AuthInfo) { persist(a) }

export function logout() { persist(null) }
