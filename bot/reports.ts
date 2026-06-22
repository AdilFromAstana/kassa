// Форматирование отчётных блоков для Telegram (HTML parse_mode).
// Переиспользует ЧИСТЫЕ селекторы фронта — единый источник логики (нет дубля бизнес-правил).
import { ordersByWaiter, bestWaiter, topDishesByDay, footfall, waiterCommission } from '../src/lib/salesReports'
import { lowStock } from '../src/lib/stockAlerts'
import type { DemoDay } from './data'
import { demoAttendance } from './data'

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₸'
const b = (s: string) => `<b>${s}</b>`

export function summaryBlock(d: DemoDay): string {
  const orders = d.closedOrders
  const revenue = orders.reduce((s, o) => s + o.total, 0)
  const checks = orders.length
  const avg = checks ? revenue / checks : 0
  const guests = orders.reduce((s, o) => s + (o.guests || 0), 0)
  const cash = orders.flatMap((o) => o.payments).filter((p: any) => p.name === 'Наличные').reduce((s: number, p: any) => s + p.amount, 0)
  const card = revenue - cash
  return [
    `💰 ${b('Сводка смены')} · ${d.date}`,
    ``,
    `Выручка: ${b(money(revenue))}`,
    `Чеков: ${b(String(checks))} · средний чек: ${money(avg)}`,
    `Гостей: ${b(String(guests))}`,
    `Наличные: ${money(cash)} · безнал: ${money(card)}`,
  ].join('\n')
}

export function topDishesBlock(d: DemoDay): string {
  const t = topDishesByDay(d.closedOrders, 5)
  const medal = ['🥇', '🥈', '🥉', '4.', '5.']
  const rows = t.rows.map((r, i) => `${medal[i] ?? `${i + 1}.`} ${r.name} — ${b(String(r.total))} шт`)
  return [`🥇 ${b('Топ-5 блюд')} · ${d.date}`, ``, ...rows].join('\n')
}

export function footfallBlock(d: DemoDay): string {
  const f = footfall(d.closedOrders)
  const peak = f.peakHour ? `${f.peakHour.key} (${f.peakHour.guests} гостей)` : '—'
  const byHour = f.byHour.slice().sort((a, b2) => b2.guests - a.guests).slice(0, 5)
    .map((h) => `${h.key} — ${h.guests} гостей / ${h.checks} чеков`)
  return [`👥 ${b('Проходимость')} · ${d.date}`, ``, `Всего гостей: ${b(String(f.total))}`, `Пик: ${b(peak)}`, ``, `Топ часов:`, ...byHour].join('\n')
}

export function bestWaiterBlock(d: DemoDay): string {
  const rows = ordersByWaiter(d.closedOrders)
  const best = bestWaiter(d.closedOrders)
  const list = rows.map((r, i) => `${i === 0 ? '🏆 ' : `${i + 1}. `}${r.waiter} — ${b(money(r.revenue))} · ${r.orders} зак.`)
  return [`🏆 ${b('Официанты')} · ${d.date}`, ``, best ? `Лучший: ${b(best.waiter)}` : 'Нет продаж', ``, ...list].join('\n')
}

export function commissionBlock(d: DemoDay): string {
  const rows = waiterCommission(d.closedOrders, d.commissionPct)
  const total = rows.reduce((s, r) => s + r.commission, 0)
  const list = rows.map((r) => `${r.waiter}: ${money(r.revenue)} → ${b(money(r.commission))}`)
  return [`💸 ${b(`Комиссия официантов (${d.commissionPct}%)`)} · ${d.date}`, ``, ...list, ``, `Итого к выплате: ${b(money(total))}`].join('\n')
}

export function lowStockBlock(d: DemoDay): string {
  const s = lowStock(d.ingredients)
  if (s.count === 0) return `📦 ${b('Остатки склада')}\n\nВсё в норме ✅`
  const out = s.out.map((i) => `🔴 ${i.name} — ${b('закончился')}`)
  const low = s.low.map((i) => `🟡 ${i.name} — ${i.stock} / мин ${i.min} ${i.unit}`)
  return [`📦 ${b('Остатки склада')}`, ``, ...out, ...low].join('\n')
}

export function attendanceBlock(d: DemoDay): string {
  const rows = demoAttendance().map((r) => {
    if (r.absent) return `🔴 ${r.staff} (${r.position}) — прогул`
    const late = r.late > 0 ? ` ⚠️ опозд. ${r.late}м` : ' ✅'
    return `${r.staff} (${r.position}) — приход ${r.in}${late}`
  })
  return [`🕒 ${b('Приход / уход')} · ${d.date}`, ``, ...rows].join('\n')
}

// Полная авто-сводка при закрытии смены (база + ключевые блоки).
export function shiftCloseSummary(d: DemoDay): string {
  return [
    `🔔 ${b('Смена закрыта')} · ${d.date}`,
    ``,
    summaryBlock(d).split('\n').slice(2).join('\n'),
    ``,
    `🏆 Лучший: ${b(bestWaiter(d.closedOrders)?.waiter ?? '—')}`,
    `🥇 Хит: ${b(topDishesByDay(d.closedOrders, 1).rows[0]?.name ?? '—')}`,
    `👥 Гостей: ${b(String(footfall(d.closedOrders).total))}`,
    lowStock(d.ingredients).count > 0 ? `📦 Низкий остаток: ${b(String(lowStock(d.ingredients).count))} поз.` : `📦 Склад в норме`,
    ``,
    `Нажмите кнопку ниже для детального отчёта 👇`,
  ].join('\n')
}
