// @vitest-environment jsdom
// Интеграционный тест: реальный клиент входа фронта (auth.ts) против ЖИВОГО бэка на :5080.
// Требует поднятый backend (docker compose up -d db && dotnet run). Проверяет связку фронт↔бэк по-настоящему.
import { describe, it, expect, beforeAll, vi } from 'vitest'

describe('auth.ts ↔ backend :5080 (live)', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_API_BASE', 'http://localhost:5080/api')
    vi.stubEnv('VITE_TRADE_POINT_ID', '00000000-0000-0000-0000-000000000001')
  })

  it('loginByPin(1111) → JWT + сотрудник + права, токен в localStorage', async () => {
    const { loginByPin, getToken, getAuth, isAuthed } = await import('./auth')
    const a = await loginByPin('1111')
    expect(a).not.toBeNull()
    expect(a!.token).toBeTruthy()
    expect(a!.employee).toContain('Петров')
    expect(a!.positions).toContain('Кассир')
    expect((a!.rights ?? []).length).toBeGreaterThan(0)
    expect(isAuthed()).toBe(true)
    expect(getToken()).toBe(a!.token)
    expect(localStorage.getItem('iiko-token')).toBe(a!.token)
    expect(getAuth()!.kind).toBe('pos')
  })

  it('loginOffice(owner@mumtaz.kz) → office-токен', async () => {
    const { loginOffice } = await import('./auth')
    const a = await loginOffice('owner@mumtaz.kz', 'owner123')
    expect(a).not.toBeNull()
    expect(a!.kind).toBe('office')
    expect(a!.role).toBe('owner')
  })

  it('неверный PIN → null', async () => {
    const { loginByPin } = await import('./auth')
    expect(await loginByPin('9999')).toBeNull()
  })

  it('неверный пароль офиса → null', async () => {
    const { loginOffice } = await import('./auth')
    expect(await loginOffice('owner@mumtaz.kz', 'wrong')).toBeNull()
  })
})
