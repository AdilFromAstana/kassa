import { describe, it, expect } from 'vitest'
import { ordersByWaiter, bestWaiter, topDishesByDay, dayKey, waiterCommission, footfall } from './salesReports'
import type { ClosedOrder } from '../types'

// минимальный закрытый чек для тестов селекторов
const order = (over: Partial<ClosedOrder>): ClosedOrder => ({
  id: 1, type: 'hall', tableId: 't1', hallId: 'h1', guests: 1, waiter: 'Иванова', opened: '',
  lines: [], at: '', paidAt: '01.06.2026, 12:00', payments: [], change: 0, total: 0, fiscalDocNo: 'd1',
  ...over,
} as ClosedOrder)

const line = (name: string, qty: number) => ({ uid: name + qty, dishId: name, name, price: 100, vat: 16 as const, qty, modifiers: [] })

describe('dayKey', () => {
  it('берёт дату из "ДД.ММ.ГГГГ, ЧЧ:ММ"', () => {
    expect(dayKey('01.06.2026, 12:34')).toBe('01.06.2026')
  })
})

describe('ordersByWaiter / bestWaiter', () => {
  const orders = [
    order({ waiter: 'Иванова', guests: 2, total: 5000 }),
    order({ waiter: 'Иванова', guests: 1, total: 3000 }),
    order({ waiter: 'Петров', guests: 4, total: 10000 }),
  ]
  it('агрегирует заказы/гостей/выручку и средний чек', () => {
    const rows = ordersByWaiter(orders)
    expect(rows[0]).toMatchObject({ waiter: 'Петров', orders: 1, guests: 4, revenue: 10000, avgCheck: 10000 })
    const iv = rows.find((r) => r.waiter === 'Иванова')!
    expect(iv).toMatchObject({ orders: 2, guests: 3, revenue: 8000, avgCheck: 4000 })
  })
  it('сортировка по выручке ↓; лучший = Петров', () => {
    expect(bestWaiter(orders)?.waiter).toBe('Петров')
  })
  it('нет продаж → лучший null', () => {
    expect(bestWaiter([])).toBeNull()
  })
})

describe('waiterCommission', () => {
  const orders = [
    order({ waiter: 'Петров', total: 50000 }),
    order({ waiter: 'Иванова', total: 30000 }),
  ]
  it('3% от личной выручки', () => {
    const rows = waiterCommission(orders, 3)
    expect(rows.find((r) => r.waiter === 'Петров')!.commission).toBe(1500)
    expect(rows.find((r) => r.waiter === 'Иванова')!.commission).toBe(900)
  })
  it('ставка 0 → нулевая комиссия', () => {
    expect(waiterCommission(orders, 0).every((r) => r.commission === 0)).toBe(true)
  })
})

describe('footfall', () => {
  const orders = [
    order({ paidAt: '01.06.2026, 12:30', guests: 2 }),
    order({ paidAt: '01.06.2026, 12:45', guests: 3 }),
    order({ paidAt: '02.06.2026, 19:10', guests: 4 }),
  ]
  it('итог гостей и разрез по дням', () => {
    const f = footfall(orders)
    expect(f.total).toBe(9)
    expect(f.byDay).toEqual([
      { key: '01.06.2026', guests: 5, checks: 2 },
      { key: '02.06.2026', guests: 4, checks: 1 },
    ])
  })
  it('пиковый час = 12:00 (5 гостей)', () => {
    expect(footfall(orders).peakHour).toMatchObject({ key: '12:00', guests: 5 })
  })
  it('пусто → total 0, peakHour null', () => {
    const f = footfall([])
    expect(f.total).toBe(0)
    expect(f.peakHour).toBeNull()
  })
})

describe('topDishesByDay', () => {
  const orders = [
    order({ paidAt: '01.06.2026, 12:00', lines: [line('Плов', 3), line('Чай', 1)] }),
    order({ paidAt: '02.06.2026, 13:00', lines: [line('Плов', 2), line('Лагман', 5)] }),
  ]
  it('дни по возрастанию, топ по суммарному кол-ву', () => {
    const r = topDishesByDay(orders, 2)
    expect(r.days).toEqual(['01.06.2026', '02.06.2026'])
    expect(r.rows.map((x) => x.name)).toEqual(['Плов', 'Лагман']) // Плов=5, Лагман=5 (Плов первым по вставке), Чай=1 отсечён
    expect(r.rows[0].byDay).toEqual({ '01.06.2026': 3, '02.06.2026': 2 })
    expect(r.rows[0].total).toBe(5)
  })
})
