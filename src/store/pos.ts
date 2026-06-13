import { create } from 'zustand'
import type {
  Order, OrderLine, ClosedOrder, Staff, CashShift, PersonalShift, StopItem, DocType, DocLine, StoreDoc, Message,
  SelectedModifier, PaymentSplit, OrderType, CashMovement, Refund, Banquet, BanquetStatus, ClosedShift, Establishment,
  Ingredient, WriteOff,
} from '../types'
import { findDish } from '../mock/menu'
import { findStaffByPin, initialBanquets, messages as messagesSeed } from '../mock/data'
import { POSITION_RIGHTS, hasRightIn } from '../lib/rights'

// Стоп-лист: блюдо недоступно, если полный стоп (remaining undefined) или остаток исчерпан (≤0).
// Позиция с remaining>0 — ограниченный остаток: продаётся, остаток тает, при 0 уходит в полный стоп.
export const isStopped = (stopList: StopItem[], dishId: string) =>
  stopList.some((s) => s.dishId === dishId && (s.remaining === undefined || s.remaining <= 0))

// Уменьшение остатка стоп-листа на проданные позиции (вызывается при оплате).
const applyStopDecrement = (stopList: StopItem[], lines: OrderLine[]): StopItem[] => {
  const sold: Record<string, number> = {}
  for (const l of lines) sold[l.dishId] = (sold[l.dishId] ?? 0) + l.qty
  return stopList.map((s) =>
    s.remaining !== undefined && sold[s.dishId]
      ? { ...s, remaining: Math.max(0, +(s.remaining - sold[s.dishId]).toFixed(3)) }
      : s)
}
import { baseIngredients, applyWriteoff, applyRestock } from '../mock/warehouse'
import { buildDemo } from '../mock/demo'

// ───────────────────────────── helpers ─────────────────────────────
const now = () => new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const fullNow = () => new Date().toLocaleString('ru-RU')
let uidSeq = 1
const nextUid = () => `l${uidSeq++}`

// Профиль по умолчанию — 🇰🇿 ресторан со столами.
const DEFAULT_ESTABLISHMENT: Establishment = {
  name: 'Ресторан (KZ)', mode: 'restaurant',
  precheck: true, comments: true, courses: true, tab: false, mix: false,
  kitchenScreen: false, banquets: true, delivery: false, iikoCard: false, fiscalBeforePay: false, frCount: 1,
}
function loadEstablishment(): Establishment {
  try {
    const raw = localStorage.getItem('iiko-establishment')
    if (raw) return { ...DEFAULT_ESTABLISHMENT, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_ESTABLISHMENT
}

// Ценовые оверрайды меню (правятся в офисе → касса применяет). dishId → цена ₸.
function loadPriceOverrides(): Record<string, number> {
  try { const raw = localStorage.getItem('iiko-menu-prices'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return {}
}

// Карта роль→права (дефолт из rights.ts + оверрайд из офиса в localStorage).
function loadRoleRights(): Record<string, string[]> {
  const base: Record<string, string[]> = {}
  for (const k of Object.keys(POSITION_RIGHTS)) base[k] = [...POSITION_RIGHTS[k]]
  try { const raw = localStorage.getItem('iiko-role-rights'); if (raw) return { ...base, ...JSON.parse(raw) } } catch { /* ignore */ }
  return base
}

// Остатки склада: база из warehouse.ts, поверх — сохранённые остатки из localStorage (id → stock).
function loadIngredients(): Ingredient[] {
  try {
    const raw = localStorage.getItem('iiko-stock')
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, number>
      return baseIngredients.map((i) => (i.id in saved ? { ...i, stock: saved[i.id] } : i))
    }
  } catch { /* ignore */ }
  return baseIngredients.map((i) => ({ ...i }))
}
function persistIngredients(ings: Ingredient[]) {
  try {
    const map: Record<string, number> = {}
    for (const i of ings) map[i.id] = i.stock
    localStorage.setItem('iiko-stock', JSON.stringify(map))
  } catch { /* ignore */ }
}

// Авто-наполнение демо-заказами при запуске (для показа заказчику). Флаг в localStorage.
function loadDemoAuto(): boolean {
  try { return localStorage.getItem('iiko-demo-auto') === '1' } catch { return false }
}
const DEMO_AUTO = loadDemoAuto()
const DEMO_INIT = DEMO_AUTO
  ? buildDemo({ count: 24, openCount: 4, startFiscal: 3681821000, startOrderId: 184, startMovement: 0 })
  : null

export const lineUnitPrice = (l: OrderLine): number =>
  l.price + l.modifiers.reduce((s, m) => s + m.price * m.qty, 0)
export const lineTotal = (l: OrderLine): number => lineUnitPrice(l) * l.qty

export const orderSubtotal = (o: Order): number => o.lines.reduce((s, l) => s + lineTotal(l), 0)
export const orderTotal = (o: Order): number => {
  const sub = orderSubtotal(o)
  return +(sub * (1 - o.discountPct / 100) * (1 + o.surchargePct / 100)).toFixed(2)
}

// ───────────────────────────── state ─────────────────────────────
interface PosState {
  staffList: Staff[]
  user: Staff | null
  personalShift: PersonalShift | null
  cashShift: CashShift | null
  cashShiftSeq: number

  orders: Order[]
  closedOrders: ClosedOrder[]
  currentOrderId: number | null
  orderSeq: number
  fiscalSeq: number

  cashMovements: CashMovement[]
  refunds: Refund[]
  writeOffs: WriteOff[] // акты списания блюд (для отчётов 024/034/037)
  documents: StoreDoc[] // складские документы кассы (Документы)
  docSeq: number
  banquets: Banquet[]
  closedShifts: ClosedShift[] // архив закрытых кассовых смен
  stopList: StopItem[] // стоп-лист: dishId + остаток порций + кто/когда внёс
  ingredients: Ingredient[] // склад: товары-ингредиенты с остатками (списываются по техкарте при продаже)
  establishment: Establishment // профиль заведения (режим + фичи), управляет видимостью кнопок
  priceOverrides: Record<string, number> // цены меню из офиса (dishId → ₸)
  roleRights: Record<string, string[]> // карта должность→права (из офиса)
  messages: Message[] // внутренние сообщения / новости
  demoAuto: boolean // авто-наполнение демо-заказами при запуске
  movementSeq: number
  refundSeq: number
  banquetSeq: number

  // auth / shifts
  login: (pin: string) => Staff | null
  logout: () => void
  openPersonalShift: (position: string) => void
  closePersonalShift: () => void
  openCashShift: () => void
  closeCashShift: () => void

  // orders
  startOrder: (opts: { tableId: string | null; hallId: string | null; guests: number; type?: OrderType }) => number
  openExistingOrder: (id: number) => void
  currentOrder: () => Order | null
  addDish: (dishId: string, modifiers?: SelectedModifier[], guestNo?: number) => void
  addGuest: (orderId: number) => void
  incLine: (uid: string) => void
  decLine: (uid: string) => void
  setLineQty: (uid: string, qty: number) => void
  removeLine: (uid: string) => void
  setGuestNo: (uid: string, guestNo: number | undefined) => void
  setDiscount: (pct: number) => void
  setSurcharge: (pct: number) => void
  precheck: () => void
  fiscalizeOrder: () => void // фискальный чек до оплаты (9.x): печать ФД, заказ → стадия оплаты, стол не закрыт
  pay: (payments: PaymentSplit[], received: number) => ClosedOrder | null
  payByGuest: (guestNo: number, payments: PaymentSplit[], received: number) => ClosedOrder | null

  // деньги, возвраты, перенос, банкеты
  addCashMovement: (kind: 'in' | 'out', type: string, amount: number, comment: string) => void
  refundOrder: (receiptNo: string, lineUids: string[] | 'all', opts: { reason: string; restock: boolean; by: string }) => Refund | null
  changePaymentType: (receiptNo: string, payments: PaymentSplit[]) => void
  moveOrderToTable: (orderId: number, tableId: string, hallId: string) => void
  mergeOrderInto: (sourceId: number, targetId: number) => void
  addBanquet: (b: Omit<Banquet, 'id' | 'status'>) => void
  setBanquetStatus: (id: number, status: BanquetStatus) => void
  addStop: (dishId: string, remaining?: number) => void
  removeStop: (dishId: string) => void
  setStopRemaining: (dishId: string, remaining: number) => void
  can: (code: string) => boolean // право текущего пользователя (F_*) по его должности
  hasRightFor: (positions: string[] | undefined, code: string) => boolean // право для произвольных должностей
  toggleRoleRight: (position: string, code: string) => void // правка карты прав в офисе
  markMessageRead: (id: number) => void
  createStoreDoc: (type: DocType, lines: DocLine[], opts?: { reason?: string; store?: string }) => StoreDoc
  setEstablishment: (patch: Partial<Establishment>) => void
  priceOf: (dishId: string, basePrice: number) => number // эффективная цена (оверрайд из офиса ?? базовая)
  setDishPrice: (dishId: string, price: number) => void  // правка цены в офисе

  // склад
  receiveStock: (ingredientId: string, qty: number) => void // приход (приходная накладная, мок)
  setIngredientStock: (ingredientId: string, qty: number) => void // инвентаризация (выставить факт)
  resetStock: () => void // вернуть стартовые остатки

  // демо-данные (для показа без бэка)
  seedDemo: (count?: number) => void   // сгенерировать закрытые+открытые заказы за сегодня
  clearDemo: () => void                // очистить все заказы/возвраты/внесения
  setDemoAuto: (on: boolean) => void   // авто-наполнение при запуске
}

export const usePos = create<PosState>((set, get) => ({
  staffList: [],
  user: null,
  personalShift: null,
  cashShift: DEMO_INIT ? { no: 108, openedAt: fullNow(), openedBy: 'Петров К.С.' } : null,
  cashShiftSeq: 108,
  orders: DEMO_INIT?.orders ?? [],
  closedOrders: DEMO_INIT?.closedOrders ?? [],
  currentOrderId: null,
  orderSeq: DEMO_INIT?.orderSeq ?? 184,
  fiscalSeq: DEMO_INIT?.fiscalSeq ?? 3681821000,
  cashMovements: DEMO_INIT?.cashMovements ?? [],
  refunds: [],
  writeOffs: DEMO_INIT?.writeOffs ?? [],
  documents: [],
  docSeq: 0,
  banquets: initialBanquets,
  closedShifts: [],
  stopList: [],
  ingredients: loadIngredients(),
  establishment: loadEstablishment(),
  priceOverrides: loadPriceOverrides(),
  roleRights: loadRoleRights(),
  messages: messagesSeed.map((m) => ({ ...m })),
  demoAuto: DEMO_AUTO,
  movementSeq: DEMO_INIT?.movementSeq ?? 0,
  refundSeq: 0,
  banquetSeq: initialBanquets.length,

  login: (pin) => {
    const s = findStaffByPin(pin) ?? null
    if (s) set({ user: s })
    return s
  },
  logout: () => set({ user: null, personalShift: null, currentOrderId: null }),

  openPersonalShift: (position) => {
    const u = get().user
    if (!u) return
    set({ personalShift: { staffId: u.id, position, openedAt: fullNow() } })
  },
  closePersonalShift: () => set({ personalShift: null, currentOrderId: null }),

  openCashShift: () => {
    const u = get().user
    set((st) => ({ cashShift: { no: st.cashShiftSeq, openedAt: fullNow(), openedBy: u?.name ?? '' } }))
  },
  closeCashShift: () =>
    set((st) => {
      const archived: ClosedShift | null = st.cashShift
        ? {
            no: st.cashShift.no,
            openedAt: st.cashShift.openedAt,
            closedAt: fullNow(),
            orders: st.closedOrders,
            revenue: st.closedOrders.reduce((s, o) => s + o.total, 0),
          }
        : null
      return {
        cashShift: null,
        cashShiftSeq: st.cashShiftSeq + 1,
        // архивируем смену и сбрасываем оперативные данные под новую смену
        closedShifts: archived ? [archived, ...st.closedShifts] : st.closedShifts,
        closedOrders: [],
        cashMovements: [],
        refunds: [],
        // незакрытые заказы переносятся (в моке просто остаются)
      }
    }),

  startOrder: ({ tableId, hallId, guests, type = 'dinein' }) => {
    const id = get().orderSeq + 1
    const order: Order = {
      id, tableId, hallId, guests,
      waiter: get().user?.name ?? '',
      type,
      lines: [], discountPct: 0, surchargePct: 0,
      openedAt: now(), status: 'open',
    }
    set((st) => ({ orders: [...st.orders, order], orderSeq: id, currentOrderId: id }))
    return id
  },
  openExistingOrder: (id) => set({ currentOrderId: id }),

  currentOrder: () => {
    const { orders, currentOrderId } = get()
    return orders.find((o) => o.id === currentOrderId) ?? null
  },

  addDish: (dishId, modifiers = [], guestNo) => {
    const dish = findDish(dishId)
    const id = get().currentOrderId
    if (!dish || id == null) return
    set((st) => ({
      orders: st.orders.map((o) => {
        if (o.id !== id) return o
        // та же позиция без модификаторов И того же гостя уже есть — +1
        if (modifiers.length === 0) {
          const existing = o.lines.find((l) => l.dishId === dishId && l.modifiers.length === 0 && l.guestNo === guestNo)
          if (existing) {
            return { ...o, lines: o.lines.map((l) => (l.uid === existing.uid ? { ...l, qty: l.qty + 1 } : l)) }
          }
        }
        const line: OrderLine = {
          uid: nextUid(), dishId, name: dish.name, price: get().priceOf(dishId, dish.price), vat: dish.vat, qty: 1, modifiers, guestNo,
        }
        return { ...o, lines: [...o.lines, line] }
      }),
    }))
  },

  addGuest: (orderId) =>
    set((st) => ({ orders: st.orders.map((o) => (o.id === orderId ? { ...o, guests: o.guests + 1 } : o)) })),

  incLine: (uid) => set((st) => ({
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.map((l) => (l.uid === uid ? { ...l, qty: l.qty + 1 } : l)) } : o),
  })),
  decLine: (uid) => set((st) => ({
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.map((l) => (l.uid === uid ? { ...l, qty: Math.max(1, l.qty - 1) } : l)) } : o),
  })),
  setLineQty: (uid, qty) => set((st) => ({
    // допускаем дробные количества (0,25 / 0,5 / 1,33 …) для весовых/штучных позиций
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.map((l) => (l.uid === uid ? { ...l, qty: qty > 0 ? qty : l.qty } : l)) } : o),
  })),
  removeLine: (uid) => set((st) => ({
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.filter((l) => l.uid !== uid) } : o),
  })),
  setGuestNo: (uid, guestNo) => set((st) => ({
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.map((l) => (l.uid === uid ? { ...l, guestNo } : l)) } : o),
  })),
  setDiscount: (pct) => set((st) => ({
    orders: st.orders.map((o) => (o.id === st.currentOrderId ? { ...o, discountPct: pct } : o)),
  })),
  setSurcharge: (pct) => set((st) => ({
    orders: st.orders.map((o) => (o.id === st.currentOrderId ? { ...o, surchargePct: pct } : o)),
  })),
  precheck: () => set((st) => ({
    orders: st.orders.map((o) => (o.id === st.currentOrderId ? { ...o, status: 'precheck' } : o)),
  })),

  fiscalizeOrder: () => set((st) => ({
    orders: st.orders.map((o) => (o.id === st.currentOrderId ? { ...o, status: 'fiscalized' } : o)),
  })),

  pay: (payments, received) => {
    const o = get().currentOrder()
    if (!o) return null
    const total = orderTotal(o)
    const paid = payments.reduce((s, p) => s + p.amount, 0)
    const change = Math.max(0, received - total)
    const fiscalDocNo = String(get().fiscalSeq + 1)
    const closed: ClosedOrder = {
      ...o, status: 'paid', paidAt: fullNow(), payments, change, total, fiscalDocNo,
    }
    set((st) => {
      // списание ингредиентов по техкарте (аналог Акта реализации iiko)
      const ingredients = applyWriteoff(st.ingredients, o.lines)
      persistIngredients(ingredients)
      return {
        closedOrders: [closed, ...st.closedOrders],
        orders: st.orders.filter((x) => x.id !== o.id),
        currentOrderId: null,
        fiscalSeq: st.fiscalSeq + 1,
        ingredients,
        stopList: applyStopDecrement(st.stopList, o.lines), // уменьшить остаток стоп-листа
      }
    })
    return closed
  },

  payByGuest: (guestNo, payments, received) => {
    const o = get().currentOrder()
    if (!o) return null
    const mine = o.lines.filter((l) => l.guestNo === guestNo)
    if (mine.length === 0) return null
    const rest = o.lines.filter((l) => l.guestNo !== guestNo)
    const sub = mine.reduce((s, l) => s + lineTotal(l), 0)
    const total = +(sub * (1 - o.discountPct / 100) * (1 + o.surchargePct / 100)).toFixed(2)
    const change = Math.max(0, received - total)
    const fiscalDocNo = String(get().fiscalSeq + 1)
    const closed: ClosedOrder = {
      ...o, lines: mine, status: 'paid', paidAt: fullNow(), payments, change, total, fiscalDocNo,
    }
    set((st) => {
      // списываем только оплаченные позиции гостя
      const ingredients = applyWriteoff(st.ingredients, mine)
      persistIngredients(ingredients)
      return {
        closedOrders: [closed, ...st.closedOrders],
        fiscalSeq: st.fiscalSeq + 1,
        ingredients,
        stopList: applyStopDecrement(st.stopList, mine), // уменьшить остаток стоп-листа

        // оставшиеся гости — в заказе; если никого не осталось, заказ закрыт
        orders: rest.length === 0
          ? st.orders.filter((x) => x.id !== o.id)
          : st.orders.map((x) => (x.id === o.id ? { ...x, lines: rest } : x)),
        currentOrderId: rest.length === 0 ? null : st.currentOrderId,
      }
    })
    return closed
  },

  addCashMovement: (kind, type, amount, comment) =>
    set((st) => ({
      cashMovements: [
        { id: st.movementSeq + 1, kind, type, amount, comment, at: fullNow() },
        ...st.cashMovements,
      ],
      movementSeq: st.movementSeq + 1,
    })),

  refundOrder: (receiptNo, lineUids, opts) => {
    let closed = get().closedOrders.find((o) => o.fiscalDocNo === receiptNo)
    if (!closed) { // искать в архиве закрытых кассовых смен
      for (const sh of get().closedShifts) {
        const f = sh.orders.find((o) => o.fiscalDocNo === receiptNo)
        if (f) { closed = f; break }
      }
    }
    if (!closed) return null
    const full = lineUids === 'all'
    const uids = full ? closed.lines.map((l) => l.uid) : lineUids
    const returnedLines = closed.lines.filter((l) => uids.includes(l.uid))
    const amount = full
      ? closed.total
      : returnedLines.reduce((s, l) => s + lineTotal(l), 0)
    const refund: Refund = {
      id: get().refundSeq + 1,
      orderId: closed.id,
      fiscalDocNo: String(get().fiscalSeq + 1),
      amount, full, lineUids: uids,
      reason: opts.reason, restock: opts.restock,
      at: fullNow(), by: opts.by,
    }
    set((st) => {
      // «со списанием на склад» — возвращаем ингредиенты возвращённых позиций в остаток
      const ingredients = opts.restock ? applyRestock(st.ingredients, returnedLines) : st.ingredients
      if (opts.restock) persistIngredients(ingredients)
      // в моке уменьшаем сумму чека на возвращённое (полный возврат → 0) — и в текущих, и в архиве
      const upd = (o: ClosedOrder) => o.fiscalDocNo === receiptNo ? { ...o, total: full ? 0 : +(o.total - amount).toFixed(2) } : o
      return {
        refunds: [refund, ...st.refunds],
        refundSeq: st.refundSeq + 1,
        fiscalSeq: st.fiscalSeq + 1,
        ingredients,
        closedOrders: st.closedOrders.map(upd),
        closedShifts: st.closedShifts.map((sh) => ({ ...sh, orders: sh.orders.map(upd) })),
      }
    })
    return refund
  },

  changePaymentType: (receiptNo, payments) =>
    set((st) => ({
      closedOrders: st.closedOrders.map((o) => (o.fiscalDocNo === receiptNo ? { ...o, payments } : o)),
    })),

  moveOrderToTable: (orderId, tableId, hallId) =>
    set((st) => ({
      orders: st.orders.map((o) => (o.id === orderId ? { ...o, tableId, hallId } : o)),
    })),

  mergeOrderInto: (sourceId, targetId) =>
    set((st) => {
      const src = st.orders.find((o) => o.id === sourceId)
      const tgt = st.orders.find((o) => o.id === targetId)
      if (!src || !tgt) return {}
      return {
        orders: st.orders
          .filter((o) => o.id !== sourceId)
          .map((o) => (o.id === targetId ? { ...o, lines: [...o.lines, ...src.lines] } : o)),
        currentOrderId: targetId,
      }
    }),

  addBanquet: (b) =>
    set((st) => ({
      banquets: [{ ...b, id: st.banquetSeq + 1, status: 'Действует' }, ...st.banquets],
      banquetSeq: st.banquetSeq + 1,
    })),

  setBanquetStatus: (id, status) =>
    set((st) => ({ banquets: st.banquets.map((b) => (b.id === id ? { ...b, status } : b)) })),

  addStop: (dishId, remaining) =>
    set((st) => (st.stopList.some((s) => s.dishId === dishId)
      ? st
      : { stopList: [...st.stopList, { dishId, remaining, byName: st.user?.name ?? '—', at: fullNow() }] })),
  removeStop: (dishId) =>
    set((st) => ({ stopList: st.stopList.filter((s) => s.dishId !== dishId) })),
  setStopRemaining: (dishId, remaining) =>
    set((st) => ({ stopList: st.stopList.map((s) => (s.dishId === dishId ? { ...s, remaining } : s)) })),
  can: (code) => hasRightIn(get().roleRights, get().user?.positions, code),
  hasRightFor: (positions, code) => hasRightIn(get().roleRights, positions, code),
  markMessageRead: (id) => set((st) => ({ messages: st.messages.map((m) => (m.id === id ? { ...m, unread: false } : m)) })),
  toggleRoleRight: (position, code) => set((st) => {
    const cur = st.roleRights[position] ?? []
    const nextList = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]
    const next = { ...st.roleRights, [position]: nextList }
    try { localStorage.setItem('iiko-role-rights', JSON.stringify(next)) } catch { /* ignore */ }
    return { roleRights: next }
  }),

  // Складской документ кассы. Инвентаризация выставляет фактический остаток, остальные — расход.
  createStoreDoc: (type, lines, opts) => {
    const doc: StoreDoc = {
      id: get().docSeq + 1, type, at: fullNow(), by: get().user?.name ?? '—',
      store: opts?.store ?? 'Основной', reason: opts?.reason, lines,
    }
    set((st) => {
      const ingredients = st.ingredients.map((i) => {
        const l = lines.find((x) => x.ingredientId === i.id)
        if (!l) return i
        const stock = type === 'Инвентаризация' ? l.qty : +(i.stock - l.qty).toFixed(3)
        return { ...i, stock }
      })
      persistIngredients(ingredients)
      return { documents: [doc, ...st.documents], docSeq: st.docSeq + 1, ingredients }
    })
    return doc
  },

  setEstablishment: (patch) => set((st) => {
    const next = { ...st.establishment, ...patch }
    try { localStorage.setItem('iiko-establishment', JSON.stringify(next)) } catch { /* ignore */ }
    return { establishment: next }
  }),
  priceOf: (dishId, basePrice) => get().priceOverrides[dishId] ?? basePrice,
  setDishPrice: (dishId, price) => set((st) => {
    const next = { ...st.priceOverrides, [dishId]: price }
    try { localStorage.setItem('iiko-menu-prices', JSON.stringify(next)) } catch { /* ignore */ }
    return { priceOverrides: next }
  }),

  receiveStock: (ingredientId, qty) => set((st) => {
    const ingredients = st.ingredients.map((i) =>
      i.id === ingredientId ? { ...i, stock: +(i.stock + qty).toFixed(3) } : i)
    persistIngredients(ingredients)
    return { ingredients }
  }),
  setIngredientStock: (ingredientId, qty) => set((st) => {
    const ingredients = st.ingredients.map((i) =>
      i.id === ingredientId ? { ...i, stock: +qty.toFixed(3) } : i)
    persistIngredients(ingredients)
    return { ingredients }
  }),
  resetStock: () => set(() => {
    const ingredients = baseIngredients.map((i) => ({ ...i }))
    persistIngredients(ingredients)
    return { ingredients }
  }),

  seedDemo: (count = 24) => set((st) => {
    const d = buildDemo({
      count, openCount: 4,
      startFiscal: st.fiscalSeq, startOrderId: st.orderSeq, startMovement: st.movementSeq,
    })
    return {
      cashShift: st.cashShift ?? { no: st.cashShiftSeq, openedAt: fullNow(), openedBy: st.user?.name ?? 'Петров К.С.' },
      orders: d.orders,
      closedOrders: d.closedOrders,
      cashMovements: d.cashMovements,
      writeOffs: d.writeOffs,
      refunds: [],
      currentOrderId: null,
      fiscalSeq: d.fiscalSeq,
      orderSeq: d.orderSeq,
      movementSeq: d.movementSeq,
    }
  }),
  clearDemo: () => set({ orders: [], closedOrders: [], cashMovements: [], writeOffs: [], refunds: [], currentOrderId: null }),
  setDemoAuto: (on) => {
    try { localStorage.setItem('iiko-demo-auto', on ? '1' : '0') } catch { /* ignore */ }
    set({ demoAuto: on })
  },
}))
