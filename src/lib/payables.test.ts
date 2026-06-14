import { describe, it, expect } from 'vitest'
import { payables, payablesSummary } from './payables'
import type { Invoice } from '../types'

const inv = (id: number, date: string, total = 1000, kind: 'in' | 'out' = 'in'): Invoice =>
  ({ id, no: 'ПН-' + id, date, supplierName: 'ТОО П', supplierBin: '0', lines: [], total, vat: 138, esfNo: 'E', kind })

// срок = дата + 14 дней
describe('payables — статус оплаты по сроку (модель iiko)', () => {
  it('задолженность (>7 дней до срока) → outstanding', () => {
    const [p] = payables([inv(1, '2026-06-01')], {}, '20260601000000')
    expect(p.dueDate).toBe('15.06.2026')
    expect(p.daysLeft).toBe(14)
    expect(p.status).toBe('outstanding')
  })
  it('≤7 дней до срока → soon (синий)', () => {
    const [p] = payables([inv(1, '2026-06-01')], {}, '20260614000000')
    expect(p.daysLeft).toBe(1)
    expect(p.status).toBe('soon')
  })
  it('срок истёк → overdue (красный)', () => {
    const [p] = payables([inv(1, '2026-06-01')], {}, '20260620000000')
    expect(p.daysLeft).toBeLessThan(0)
    expect(p.status).toBe('overdue')
  })
  it('оплачено → paid (зелёный) независимо от срока', () => {
    const [p] = payables([inv(1, '2026-06-01')], { 1: true }, '20260620000000')
    expect(p.status).toBe('paid')
    expect(p.paid).toBe(true)
  })
  it('исходящие ЭСФ (kind=out) не считаются задолженностью поставщику', () => {
    expect(payables([inv(1, '2026-06-01', 1000, 'out')], {}, '20260601000000')).toHaveLength(0)
  })
  it('сортировка по сроку оплаты', () => {
    const list = payables([inv(2, '2026-06-10'), inv(1, '2026-06-01')], {}, '20260601000000')
    expect(list.map((p) => p.id)).toEqual([1, 2])
  })
})

describe('payablesSummary — итоги по задолженности', () => {
  it('долг (неоплаченные) / просрочено / оплачено', () => {
    const list = payables([inv(1, '2026-06-01', 1000), inv(2, '2026-06-25', 500), inv(3, '2026-06-10', 700)], { 3: true }, '20260620000000')
    const s = payablesSummary(list)
    expect(s.debt).toBe(1500)   // 1000 + 500 не оплачены
    expect(s.paid).toBe(700)    // №3 оплачен
    expect(s.overdue).toBe(1000) // №1 срок 15.06 < 20.06
  })
})
