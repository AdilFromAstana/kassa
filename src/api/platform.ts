// Платформенный API (PlatformAdmin): реестр клиентов-сетей, создание, вход-как-клиент, блокировка.
import { getToken } from './auth'

const BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api'

export interface TenantRow {
  id: string
  name: string
  bin: string
  plan: string
  status: string
  createdAt: string
  ownerEmail: string | null
  points: number
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

export const listTenants = () => req<TenantRow[]>('GET', '/platform/tenants')
export const createTenant = (networkName: string, bin: string, ownerEmail: string, ownerName: string, ownerPassword: string) =>
  req<{ tenantId: string; ownerEmail: string }>('POST', '/platform/tenants', { networkName, bin, ownerEmail, ownerName, ownerPassword })
export const loginAsClient = (id: string) =>
  req<{ token: string; tenantId: string; role: string; ownerEmail: string }>('POST', `/platform/tenants/${id}/login-as`)
export const setTenantStatus = (id: string, status: 'active' | 'blocked') =>
  req<{ id: string; status: string }>('PATCH', `/platform/tenants/${id}/status`, { status })
