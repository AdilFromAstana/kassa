import { describe, it, expect } from 'vitest'
import { buildAutoPostings } from './ledger'
import type { ClosedOrder, Invoice, CashMovement, Ingredient } from '../types'

const ing = (id: string, cost: number): Ingredient => ({ id, code: id, name: id, unit: 'шт', stock: 100, costPerUnit: cost, min: 0 })

const sale = (id: number, total: number, cash: number): ClosedOrder => ({
  id, total, paidAt: '14.06.2026, 19:00', status: 'paid', change: 0, fiscalDocNo: String(id),
  payments: [{ paymentTypeId: 'p-cash', name: 'Наличные', amount: cash }, { paymentTypeId: 'p-card', name: 'Карта', amount: +(total - cash).toFixed(2) }].filter((p) => p.amount > 0),
  lines: [{ uid: 'l' + id, dishId: 'd-cola', name: 'Кола', price: total, vat: 16, qty: 1, modifiers: [] }],
} as unknown as ClosedOrder)

describe('buildAutoPostings — двойная запись сбалансирована', () => {
  it('Σ дебетовых сумм == Σ кредитовых (по построению)', () => {
    const entries = buildAutoPostings({
      closedOrders: [sale(1, 1160, 1160), sale(2, 2000, 1000)],
      invoices: [{ id: 1, no: 'ПН-1', date: '2026-06-14', supplierName: 'П', supplierBin: '0', lines: [], total: 1160, vat: 160, esfNo: 'E', kind: 'in' }] as Invoice[],
      cashMovements: [{ id: 1, kind: 'out', type: 'Выплата зарплаты', amount: 50000, comment: 'Иванова', at: '14.06.2026, 20:00' }] as CashMovement[],
      ingredients: [ing('i-cola', 350)],
    })
    const drTotal = +entries.reduce((s, e) => s + e.amount, 0).toFixed(2)
    const byDebit = entries.reduce((m, e) => { m[e.debit] = (m[e.debit] ?? 0) + e.amount; return m }, {} as Record<string, number>)
    const byCredit = entries.reduce((m, e) => { m[e.credit] = (m[e.credit] ?? 0) + e.amount; return m }, {} as Record<string, number>)
    const sumDr = +Object.values(byDebit).reduce((s, v) => s + v, 0).toFixed(2)
    const sumCr = +Object.values(byCredit).reduce((s, v) => s + v, 0).toFixed(2)
    expect(sumDr).toBe(drTotal)
    expect(sumCr).toBe(drTotal)
  })
})

describe('buildAutoPostings — проводки конкретной продажи', () => {
  it('продажа 1160 нал → Дт1010/Кт6010 1160, Дт6010/Кт3130 160 (ҚҚС), Дт7010/Кт1330 350 (себест)', () => {
    const entries = buildAutoPostings({ closedOrders: [sale(7, 1160, 1160)], invoices: [], cashMovements: [], ingredients: [ing('i-cola', 350)] })
    const find = (d: string, c: string) => entries.find((e) => e.debit === d && e.credit === c)
    expect(find('1010', '6010')?.amount).toBe(1160)
    expect(find('6010', '3130')?.amount).toBe(160)
    expect(find('7010', '1330')?.amount).toBe(350)
    // безнал=0 → проводки 1030/6010 нет
    expect(find('1030', '6010')).toBeUndefined()
  })
})
