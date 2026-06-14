import type { Invoice } from '../types'
import { dateSortKey } from './stockMoves'

// ─────────────────────────────────────────────────────────────────────────────
// Задолженность перед контрагентами / Приём платежей (iiko, раздел 07/08).
// Источник — приходные накладные (kind=in). Статус оплаты + срок (date + term дней).
// Цветовая модель iiko: оплачено=green, просрочен=red, ≤7 дней=blue, иначе=black.
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_TERM_DAYS = 14 // срок оплаты поставщику по умолчанию (нет поля «срок» в моке)

export type PayableStatus = 'paid' | 'overdue' | 'soon' | 'outstanding'

export interface Payable {
  id: number; no: string; date: string; dueKey: string; dueDate: string
  supplierName: string; total: number; vat: number
  paid: boolean; status: PayableStatus; daysLeft: number
}

// dateSortKey('yyyymmddhhmmss') → разбираем yyyy/mm/dd
const keyToDate = (k: string) => ({ y: +k.slice(0, 4), m: +k.slice(4, 6), d: +k.slice(6, 8) })
// число дней между двумя нормализованными ключами (по календарю UTC)
const daysBetween = (fromKey: string, toKey: string): number => {
  const a = keyToDate(fromKey), b = keyToDate(toKey)
  const da = Date.UTC(a.y, a.m - 1, a.d), db = Date.UTC(b.y, b.m - 1, b.d)
  return Math.round((db - da) / 86400000)
}
// прибавить дни к ключу даты → ключ + читаемая дата dd.mm.yyyy
const addDaysToKey = (key: string, days: number) => {
  const a = keyToDate(key); const t = new Date(Date.UTC(a.y, a.m - 1, a.d + days))
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { key: `${y}${pad(m)}${pad(d)}000000`, label: `${pad(d)}.${pad(m)}.${y}` }
}

// Список задолженности по приходным накладным на дату todayKey (нормализованный ключ дня).
export function payables(invoices: Invoice[], paidMap: Record<number, boolean>, todayKey: string, termDays = PAYMENT_TERM_DAYS): Payable[] {
  return invoices.filter((i) => i.kind !== 'out').map((i) => {
    const due = addDaysToKey(dateSortKey(i.date), termDays)
    const paid = !!paidMap[i.id]
    const daysLeft = daysBetween(todayKey, due.key)
    const status: PayableStatus = paid ? 'paid' : daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'soon' : 'outstanding'
    return { id: i.id, no: i.no, date: i.date, dueKey: due.key, dueDate: due.label, supplierName: i.supplierName, total: i.total, vat: i.vat, paid, status, daysLeft }
  }).sort((a, b) => a.dueKey.localeCompare(b.dueKey))
}

// Итоги: всего долг / просрочено / к оплате в ближайшие 7 дней / оплачено.
export function payablesSummary(list: Payable[]) {
  const sum = (f: (p: Payable) => boolean) => +list.filter(f).reduce((s, p) => s + p.total, 0).toFixed(2)
  return {
    debt: sum((p) => !p.paid),
    overdue: sum((p) => p.status === 'overdue'),
    soon: sum((p) => p.status === 'soon'),
    paid: sum((p) => p.paid),
  }
}
