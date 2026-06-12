import type { Order, ClosedOrder, OrderLine, PaymentSplit, CashMovement, WriteOff } from '../types'
import { dishes } from './menu'
import { paymentTypes } from './data'
import { staff, tables } from './data'
import { baseIngredients, dishCost } from './warehouse'

// Генератор демо-данных для показа заказчику без бэка: пачка реалистичных закрытых заказов
// за «сегодняшний вечер» (время — относительно момента запуска), плюс несколько открытых
// заказов на столах и внесения наличных. По закрытым заказам можно выбивать чеки, возвраты,
// менять тип оплаты, строить отчёты и закрывать смену.

const rnd = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const chance = (p: number) => Math.random() < p

const hhmm = (d: Date) => d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const full = (d: Date) => d.toLocaleString('ru-RU')

const sellable = dishes.filter((d) => d.groupId !== 'g-service') // услуги в чек не кладём
const waiters = staff.filter((s) => s.positions.some((p) => ['Кассир', 'Официант', 'Бармен'].includes(p)))

export interface DemoSlice {
  closedOrders: ClosedOrder[]
  orders: Order[]
  cashMovements: CashMovement[]
  writeOffs: WriteOff[]
  fiscalSeq: number
  orderSeq: number
  movementSeq: number
}

export interface DemoOpts {
  count?: number       // сколько закрытых заказов
  openCount?: number   // сколько открытых заказов на столах
  startFiscal: number  // текущий fiscalSeq
  startOrderId: number // текущий orderSeq
  startMovement: number
  nowMs?: number       // «сейчас» (по умолч. Date.now())
}

let uidSeq = 0
const uid = () => `seed-${uidSeq++}`

function makeLines(): OrderLine[] {
  const n = rnd(1, 5)
  const lines: OrderLine[] = []
  for (let i = 0; i < n; i++) {
    const d = pick(sellable)
    lines.push({ uid: uid(), dishId: d.id, name: d.name, price: d.price, vat: d.vat, qty: rnd(1, 3), modifiers: [] })
  }
  return lines
}

const subtotal = (lines: OrderLine[]) => lines.reduce((s, l) => s + l.price * l.qty, 0)

function makePayments(total: number): { payments: PaymentSplit[]; change: number } {
  // 60% наличные, 25% карта, 10% безнал, 5% сплит нал+карта
  const r = Math.random()
  const cash = paymentTypes.find((p) => p.id === 'p-cash')!
  const card = paymentTypes.find((p) => p.id === 'p-card')!
  const cashless = paymentTypes.find((p) => p.id === 'p-cashless')!
  if (r < 0.6) {
    const received = Math.ceil(total / 500) * 500 // округляем вверх до 500₸
    return { payments: [{ paymentTypeId: cash.id, name: cash.name, amount: total }], change: +(received - total).toFixed(2) }
  }
  if (r < 0.85) return { payments: [{ paymentTypeId: card.id, name: card.name, amount: total }], change: 0 }
  if (r < 0.95) return { payments: [{ paymentTypeId: cashless.id, name: cashless.name, amount: total }], change: 0 }
  const half = +(total / 2).toFixed(2)
  return { payments: [
    { paymentTypeId: cash.id, name: cash.name, amount: half },
    { paymentTypeId: card.id, name: card.name, amount: +(total - half).toFixed(2) },
  ], change: 0 }
}

export function buildDemo(opts: DemoOpts): DemoSlice {
  uidSeq = 0
  const count = opts.count ?? 24
  const openCount = opts.openCount ?? 4
  const nowMs = opts.nowMs ?? Date.now()
  const spanMs = 8 * 3600 * 1000 // заказы за последние ~8 часов
  const startMs = nowMs - spanMs

  let fiscalSeq = opts.startFiscal
  let orderId = opts.startOrderId
  let movementSeq = opts.startMovement

  // ── закрытые заказы (по возрастанию времени) ──
  const closed: ClosedOrder[] = []
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 1
    const paidMs = startMs + frac * spanMs + rnd(-600, 600) * 1000
    const paidD = new Date(Math.min(paidMs, nowMs))
    const openD = new Date(paidD.getTime() - rnd(8, 45) * 60 * 1000)

    const lines = makeLines()
    const sub = subtotal(lines)
    const discountPct = chance(0.18) ? pick([5, 10]) : 0
    const total = +(sub * (1 - discountPct / 100)).toFixed(2)
    const onTable = chance(0.7)
    const table = onTable ? pick(tables) : null
    const staffMeal = chance(0.05) // питание персонала (без выручки)

    let payments: PaymentSplit[]
    let change = 0
    let tip = 0
    if (staffMeal) {
      const nr = paymentTypes.find((p) => p.id === 'p-norev')!
      payments = [{ paymentTypeId: nr.id, name: nr.name, amount: total }]
    } else {
      const r = makePayments(total)
      payments = r.payments
      change = r.change
      // чаевые: ~30% безналичных оплат, 5–10% от чека, округление до 100₸
      const cardish = payments.some((p) => p.paymentTypeId === 'p-card' || p.paymentTypeId === 'p-cashless')
      if (cardish && chance(0.3)) tip = Math.round((total * pick([0.05, 0.1])) / 100) * 100
    }
    fiscalSeq += 1
    orderId += 1
    closed.push({
      id: orderId,
      tableId: table?.id ?? null,
      hallId: table?.hallId ?? null,
      guests: onTable ? rnd(1, 4) : 1,
      waiter: pick(waiters).name,
      type: onTable ? 'dinein' : 'takeaway',
      lines,
      discountPct,
      surchargePct: 0,
      openedAt: hhmm(openD),
      status: 'paid',
      paidAt: full(paidD),
      payments,
      change,
      total,
      fiscalDocNo: String(fiscalSeq),
      tip: tip || undefined,
      staffMeal: staffMeal || undefined,
    })
  }
  // гарантируем непустые отчёты 032/054: хотя бы одно питание персонала и одни чаевые
  if (closed.length > 0) {
    if (!closed.some((o) => o.staffMeal)) {
      const o = closed[0]
      const nr = paymentTypes.find((p) => p.id === 'p-norev')!
      o.staffMeal = true
      o.payments = [{ paymentTypeId: nr.id, name: nr.name, amount: o.total }]
      o.tip = undefined
    }
    if (!closed.some((o) => o.tip)) {
      const o = closed.find((x) => !x.staffMeal) ?? closed[closed.length - 1]
      o.tip = Math.max(200, Math.round((o.total * 0.07) / 100) * 100)
    }
  }

  // в сторе новые заказы лежат первыми — переворачиваем (свежие сверху)
  closed.reverse()

  // ── открытые заказы на столах (можно оплатить вживую) ──
  const open: Order[] = []
  const usedTables = new Set<string>()
  for (let i = 0; i < openCount; i++) {
    let t = pick(tables)
    let guard = 0
    while (usedTables.has(t.id) && guard++ < 10) t = pick(tables)
    usedTables.add(t.id)
    const openD = new Date(nowMs - rnd(5, 60) * 60 * 1000)
    orderId += 1
    open.push({
      id: orderId,
      tableId: t.id,
      hallId: t.hallId,
      guests: rnd(1, 4),
      waiter: pick(waiters).name,
      type: 'dinein',
      lines: makeLines(),
      discountPct: 0,
      surchargePct: 0,
      openedAt: hhmm(openD),
      status: 'open',
    })
  }

  // ── внесения/изъятия наличных (для пересчёта смены и отчётов 052/038/037) ──
  const movements: CashMovement[] = []
  const addMv = (kind: 'in' | 'out', type: string, amount: number, comment: string, at: Date) => {
    movementSeq += 1
    movements.push({ id: movementSeq, kind, type, amount, comment, at: full(at) })
  }
  addMv('in', 'Внесение разменной монеты', 20000, 'Размен на начало смены', new Date(startMs))
  addMv('out', 'Выплата зарплаты', 35000, 'Аванс официанту', new Date(startMs + spanMs * 0.5))
  addMv('out', 'Изъятие (инкассация)', 150000, 'Промежуточная инкассация', new Date(nowMs - 30 * 60 * 1000))

  // ── акты списания блюд (для отчётов 024/034/037) ──
  const reasons = ['Бой/порча', 'Брак (пересол)', 'Проработка', 'Дегустация для гостя']
  const writeOffs: WriteOff[] = []
  const woDishes = dishes.filter((d) => d.groupId !== 'g-service')
  for (let i = 0; i < 3; i++) {
    const d = pick(woDishes)
    const qty = rnd(1, 2)
    writeOffs.push({
      id: i + 1, dishId: d.id, name: d.name, qty, reason: pick(reasons),
      cost: +(dishCost(d.id, baseIngredients) * qty).toFixed(2),
      at: full(new Date(startMs + Math.random() * spanMs)),
    })
  }

  return { closedOrders: closed, orders: open, cashMovements: movements, writeOffs, fiscalSeq, orderSeq: orderId, movementSeq }
}
