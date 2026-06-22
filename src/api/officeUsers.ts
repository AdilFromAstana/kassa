// C2: офисные пользователи сети (app_user) — роль + скоуп по точкам.
import { getToken } from './auth'

const BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api'

export interface OfficeUser {
  id: string
  email: string
  role: string
  pointScope: string[]
  wholeNetwork: boolean
  active: boolean
  createdAt: string
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body == null ? undefined : JSON.stringify(body),
    })
    return res.ok ? ((await res.json().catch(() => ({}))) as T) : null
  } catch { return null }
}

export const listUsers = () => req<OfficeUser[]>('GET', '/office/users')
export const createUser = (email: string, password: string, role: string, pointScope: string[]) =>
  req<{ id: string }>('POST', '/office/users', { email, password, role, pointScope })
export const updateUser = (id: string, patch: { role?: string; pointScope?: string[]; active?: boolean }) =>
  req('PUT', `/office/users/${id}`, patch)
