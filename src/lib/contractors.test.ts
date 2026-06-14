import { describe, it, expect } from 'vitest'
import { contractorBalances, contractorSverka } from './contractors'
import type { Contractor, Invoice } from '../types'

const c = (id: string, name: string): Contractor => ({ id, name, bin: '000000000000' })
const inv = (no: string, name: string, total: number, vat: number, kind: 'in' | 'out', date: string): Invoice =>
  ({ id: +no.replace(/\D/g, '') || 1, no, date, supplierName: name, supplierBin: '0', lines: [], total, vat, esfNo: 'E', kind })

describe('contractorBalances — сальдо по документам', () => {
  it('закупки (вх.) минусом, продажи (исх.) плюсом; сальдо = продажи − закупки', () => {
    const contractors = [c('c1', 'ТОО Поставщик'), c('c2', 'Без операций')]
    const invoices = [
      inv('ПН-1', 'ТОО Поставщик', 1160, 160, 'in', '2026-06-10'),
      inv('ПН-2', 'ТОО Поставщик', 580, 80, 'in', '2026-06-12'),
      inv('ЭСФ-1', 'ТОО Поставщик', 300, 41, 'out', '2026-06-13'),
    ]
    const [b, empty] = contractorBalances(contractors, invoices)
    expect(b.purchases).toBe(1740)
    expect(b.sales).toBe(300)
    expect(b.vatIn).toBe(240)
    expect(b.balance).toBe(-1440) // 300 − 1740: мы должны
    expect(b.docCount).toBe(3)
    expect(empty.purchases).toBe(0)
    expect(empty.balance).toBe(0)
  })
})

describe('contractorSverka — накопительное сальдо по датам', () => {
  it('хронология с running-балансом (вх. −, исх. +)', () => {
    const invoices = [
      inv('ЭСФ-1', 'ТОО Поставщик', 300, 41, 'out', '2026-06-13'),
      inv('ПН-1', 'ТОО Поставщик', 1000, 138, 'in', '2026-06-10'),
      inv('ПН-2', 'ТОО Поставщик', 500, 69, 'in', '2026-06-12'),
    ]
    const rows = contractorSverka('ТОО Поставщик', invoices)
    expect(rows.map((r) => r.no)).toEqual(['ПН-1', 'ПН-2', 'ЭСФ-1']) // отсортировано по дате
    expect(rows.map((r) => r.balance)).toEqual([-1000, -1500, -1200]) // −1000, −1500, затем +300
  })
})
