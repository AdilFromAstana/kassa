// C1: структура сети — дерево Юрлицо → Подразделение → ТП → Склад. Источник: бэк /office/structure.
import { getToken } from './auth'

const BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api'

export interface StructWarehouse { id: string; name: string }
export interface StructPoint { id: string; name: string; tradePointId: string; warehouses: StructWarehouse[] }
export interface StructDivision { id: string; name: string; points: StructPoint[] }
export interface StructLegal { id: string; name: string; bin: string; divisions: StructDivision[] }

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

export const getStructure = () => req<StructLegal[]>('GET', '/office/structure')
export const addLegal = (name: string, bin: string) => req<{ id: string }>('POST', '/office/legals', { name, bin })
export const delLegal = (id: string) => req('DELETE', `/office/legals/${id}`)
export const addDivision = (legalId: string, name: string) => req<{ id: string }>('POST', '/office/divisions', { legalId, name })
export const delDivision = (id: string) => req('DELETE', `/office/divisions/${id}`)
export const addPoint = (name: string, divisionId: string) => req<{ corpId: string; tradePointId: string }>('POST', '/office/points', { name, divisionId })
export const delPoint = (id: string) => req('DELETE', `/office/points/${id}`)
export const addWarehouse = (pointId: string, name: string) => req<{ id: string }>('POST', '/office/warehouses', { pointId, name })
export const delWarehouse = (id: string) => req('DELETE', `/office/warehouses/${id}`)
