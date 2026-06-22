import type { ClosedOrder } from '../types'

// Витрины по продажам (модули 5 «заказы/официант» и 7 «топ блюд по дням»).
// Чистые селекторы из закрытых чеков — единый источник для офисных отчётов и будущего Telegram-бота.

// Дата из строки "ДД.ММ.ГГГГ, ЧЧ:ММ" (формат paidAt) → "ДД.ММ.ГГГГ".
export const dayKey = (s: string): string => (s.split(',')[0] ?? s).trim()

// Час из строки "ДД.ММ.ГГГГ, ЧЧ:ММ" → "ЧЧ:00" (или "—").
export const hourKey = (s: string): string => {
  const hh = (s.split(',')[1] ?? '').trim().slice(0, 2)
  return hh ? `${hh}:00` : '—'
}

export interface WaiterRow {
  waiter: string
  orders: number
  guests: number
  revenue: number
  avgCheck: number
}

// Сводка по официантам: число заказов, гостей, выручка, средний чек. Сортировка по выручке ↓.
export function ordersByWaiter(closedOrders: ClosedOrder[]): WaiterRow[] {
  const acc: Record<string, { orders: number; guests: number; revenue: number }> = {}
  for (const o of closedOrders) {
    const k = o.waiter || '—'
    const r = (acc[k] ??= { orders: 0, guests: 0, revenue: 0 })
    r.orders += 1
    r.guests += o.guests || 0
    r.revenue += o.total
  }
  return Object.entries(acc)
    .map(([waiter, r]) => ({ waiter, ...r, avgCheck: r.orders ? r.revenue / r.orders : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

// Лучший официант (по выручке) или null, если продаж нет.
export function bestWaiter(closedOrders: ClosedOrder[]): WaiterRow | null {
  return ordersByWaiter(closedOrders)[0] ?? null
}

export interface WaiterCommissionRow extends WaiterRow {
  commission: number // выручка × ставка% (комиссия официанта «здесь и сейчас»)
}

// Расчёт комиссии официантов (модуль «офик закрыл кассу → сразу его N% за сегодня»).
// ratePct — ставка в процентах (по умолчанию задаётся вызывающим из настроек заведения).
export function waiterCommission(closedOrders: ClosedOrder[], ratePct: number): WaiterCommissionRow[] {
  return ordersByWaiter(closedOrders).map((r) => ({
    ...r,
    commission: +(r.revenue * ratePct / 100).toFixed(2),
  }))
}

export interface FootfallRow { key: string; guests: number; checks: number }
export interface Footfall {
  total: number                 // всего гостей за период
  byDay: FootfallRow[]          // по дням (по возрастанию)
  byHour: FootfallRow[]         // по часам (по возрастанию)
  peakHour: FootfallRow | null  // час с максимумом гостей
}

// Проходимость (модуль «сколько человек пришло в ресторан»): гости и чеки по дням/часам.
export function footfall(closedOrders: ClosedOrder[]): Footfall {
  const acc = (keyFn: (o: ClosedOrder) => string): FootfallRow[] => {
    const m: Record<string, FootfallRow> = {}
    for (const o of closedOrders) {
      const k = keyFn(o)
      const r = (m[k] ??= { key: k, guests: 0, checks: 0 })
      r.guests += o.guests || 0
      r.checks += 1
    }
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key))
  }
  const byHour = acc((o) => hourKey(o.paidAt))
  const peakHour = byHour.reduce<FootfallRow | null>((best, r) => (!best || r.guests > best.guests ? r : best), null)
  return {
    total: closedOrders.reduce((s, o) => s + (o.guests || 0), 0),
    byDay: acc((o) => dayKey(o.paidAt)),
    byHour,
    peakHour,
  }
}

export interface TopDishesByDay {
  days: string[]                                            // даты периода (по возрастанию)
  rows: { name: string; total: number; byDay: Record<string, number> }[] // топ-N блюд по итогу ↓
}

// Топ-N блюд по дням: матрица блюдо × день (количество), отобраны топ-N по суммарному кол-ву.
export function topDishesByDay(closedOrders: ClosedOrder[], topN = 5): TopDishesByDay {
  const daySet = new Set<string>()
  const byDish: Record<string, { name: string; total: number; byDay: Record<string, number> }> = {}
  for (const o of closedOrders) {
    const d = dayKey(o.paidAt)
    daySet.add(d)
    for (const l of o.lines) {
      const r = (byDish[l.name] ??= { name: l.name, total: 0, byDay: {} })
      r.total += l.qty
      r.byDay[d] = (r.byDay[d] ?? 0) + l.qty
    }
  }
  const days = [...daySet].sort((a, b) => a.localeCompare(b))
  const rows = Object.values(byDish).sort((a, b) => b.total - a.total).slice(0, topN)
  return { days, rows }
}
