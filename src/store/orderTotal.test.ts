// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { orderTotal } from './pos'
import type { Order } from '../types'

const order = (over: Partial<Order>): Order => ({
  id: 1, tableId: null, hallId: null, guests: 1, waiter: '', type: 'dinein',
  lines: [{ uid: 'l1', dishId: 'd', name: 'X', price: 1000, vat: 16, qty: 1, modifiers: [] }],
  discountPct: 0, surchargePct: 0, openedAt: '', status: 'open', ...over,
})

describe('orderTotal — сервисный сбор', () => {
  it('без сбора итог = подытог', () => {
    expect(orderTotal(order({}))).toBe(1000)
  })
  it('сбор 10% увеличивает итог', () => {
    expect(orderTotal(order({ serviceChargePct: 10 }))).toBe(1100)
  })
  it('сбор применяется после % скидки/надбавки и до фикс-скидки', () => {
    // sub 1000 → скидка 10% = 900 → сервис 10% = 990 → − фикс 90 = 900
    expect(orderTotal(order({ discountPct: 10, serviceChargePct: 10, discountAmount: 90 }))).toBe(900)
  })
  it('сбор и надбавка совместимы', () => {
    // 1000 × 1.05 (надбавка) × 1.10 (сервис) = 1155
    expect(orderTotal(order({ surchargePct: 5, serviceChargePct: 10 }))).toBe(1155)
  })
})
