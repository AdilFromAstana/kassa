import type { Contractor, Invoice } from '../types'
import { dateSortKey } from './stockMoves'

// ─────────────────────────────────────────────────────────────────────────────
// Взаиморасчёты с контрагентами (раздел 08). Источник — приходные накладные
// (kind=in, мы должны поставщику) и исходящие ЭСФ (kind=out, покупатель должен нам).
// Оплаты контрагентам в моке не фиксируются → сальдо = «по документам» (без зачёта оплат).
// Сальдо = Продажи (исх.) − Закупки (вх.): >0 — нам должны, <0 — мы должны.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContractorBalance {
  id: string; name: string; bin: string
  purchases: number; sales: number; vatIn: number; vatOut: number
  balance: number; docCount: number
}

const sum = (xs: number[]) => +xs.reduce((s, x) => s + x, 0).toFixed(2)

export function contractorBalances(contractors: Contractor[], invoices: Invoice[]): ContractorBalance[] {
  return contractors.map((c) => {
    const mine = invoices.filter((i) => i.supplierName === c.name)
    const ins = mine.filter((i) => i.kind !== 'out')
    const outs = mine.filter((i) => i.kind === 'out')
    const purchases = sum(ins.map((i) => i.total))
    const sales = sum(outs.map((i) => i.total))
    return {
      id: c.id, name: c.name, bin: c.bin,
      purchases, sales,
      vatIn: sum(ins.map((i) => i.vat)), vatOut: sum(outs.map((i) => i.vat)),
      balance: +(sales - purchases).toFixed(2), docCount: mine.length,
    }
  })
}

export interface SverkaRow { date: string; no: string; kind: string; amount: number; vat: number; balance: number }

// Акт сверки: хронология документов контрагента с накопительным сальдо.
export function contractorSverka(name: string, invoices: Invoice[]): SverkaRow[] {
  const rows = invoices
    .filter((i) => i.supplierName === name)
    .sort((a, b) => dateSortKey(a.date).localeCompare(dateSortKey(b.date)))
  let bal = 0
  return rows.map((i) => {
    const out = i.kind === 'out'
    const amount = out ? i.total : -i.total
    bal = +(bal + amount).toFixed(2)
    return { date: i.date, no: i.no, kind: out ? 'Продажа (исх. ЭСФ)' : 'Закупка (прих. накладная)', amount, vat: i.vat, balance: bal }
  })
}
