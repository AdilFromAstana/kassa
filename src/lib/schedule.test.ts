import { describe, it, expect } from 'vitest'
import { shiftHours, plannedHours } from './schedule'

const SHIFTS = [
  { id: 'sh-day', from: '09:00', to: '18:00' },
  { id: 'sh-eve', from: '14:00', to: '23:00' },
  { id: 'sh-half', from: '10:00', to: '14:30' },
]

describe('shiftHours', () => {
  it('дневная 09–18 = 9 ч', () => expect(shiftHours({ from: '09:00', to: '18:00' })).toBe(9))
  it('с половиной 10:00–14:30 = 4.5 ч', () => expect(shiftHours({ from: '10:00', to: '14:30' })).toBe(4.5))
  it('некорректное время → 0', () => expect(shiftHours({ from: '18:00', to: '09:00' })).toBe(0))
})

describe('plannedHours', () => {
  it('сумма часов назначенных смен', () => {
    const assignments = { '2026-06-14': 'sh-day', '2026-06-15': 'sh-eve', '2026-06-16': 'sh-half' }
    expect(plannedHours(assignments, SHIFTS)).toBe(22.5) // 9 + 9 + 4.5
  })
  it('пустое расписание = 0', () => expect(plannedHours({}, SHIFTS)).toBe(0))
  it('неизвестный тип смены игнорируется', () => expect(plannedHours({ d: 'нет-такого' }, SHIFTS)).toBe(0))
})
