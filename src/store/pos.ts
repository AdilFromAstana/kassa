import { create } from 'zustand'
import type {
  Order, OrderLine, ClosedOrder, Staff, CashShift, PersonalShift, StopItem, DocType, DocLine, StoreDoc, Message, TechCardItem, Contractor, Invoice, InvoiceLine,
  SelectedModifier, PaymentSplit, OrderType, CashMovement, Refund, Banquet, BanquetStatus, ClosedShift, Establishment,
  Ingredient, WriteOff, PriceOrder, PriceOrderLine, SalaryPayout, PaymentType, CashOpType, Discount, ClubCard,
  MotivationProgram, SalaryDeduction,
} from '../types'
import { findDish } from '../mock/menu'
import { initialBanquets, messages as messagesSeed, contractors as contractorsSeed, staff as staffSeed,
  paymentTypes as paymentTypesSeed, cashOpTypeSeed, writeoffReasonSeed, discountSeed, clubCardSeed, motivationSeed } from '../mock/data'
import { POSITION_RIGHTS, hasRightIn } from '../lib/rights'

// Стоп-лист: блюдо недоступно, если полный стоп (remaining undefined) или остаток исчерпан (≤0).
// Позиция с remaining>0 — ограниченный остаток: продаётся, остаток тает, при 0 уходит в полный стоп.
// область стопа применяется к текущему месту: везде ('all'/нет) / этот терминал / конкретный зал
export const stopApplies = (s: StopItem, hallId?: string | null) =>
  !s.scope || s.scope === 'all' || s.scope === 'terminal' || s.scope === hallId
export const isStopped = (stopList: StopItem[], dishId: string, hallId?: string | null) =>
  stopList.some((s) => s.dishId === dishId && !s.optionId && (s.remaining === undefined || s.remaining <= 0) && stopApplies(s, hallId))

// Стоп конкретного модификатора (опции) — блокирует выбор опции в окне модификаторов.
export const isOptionStopped = (stopList: StopItem[], optionId: string) =>
  stopList.some((s) => s.optionId === optionId)

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

// Оверрайды техкарт из офиса (dishId → закладка). Касса списывает по ним.
function loadTechCards(): Record<string, TechCardItem[]> {
  try { const raw = localStorage.getItem('iiko-techcards'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return {}
}

function loadContractors(): Contractor[] {
  try { const raw = localStorage.getItem('iiko-contractors'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return contractorsSeed.map((c) => ({ ...c }))
}
function loadInvoices(): Invoice[] {
  try { const raw = localStorage.getItem('iiko-invoices'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return []
}

// Сотрудники: справочник из офиса (карточки), seed из data.ts, поверх — сохранённые в localStorage.
function loadStaff(): Staff[] {
  try { const raw = localStorage.getItem('iiko-staff'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return staffSeed.map((s) => ({ ...s }))
}
function persistStaff(list: Staff[]) {
  try { localStorage.setItem('iiko-staff', JSON.stringify(list)) } catch { /* ignore */ }
}

// Приказы об изменении цен (Прейскурант).
function loadPriceOrders(): PriceOrder[] {
  try { const raw = localStorage.getItem('iiko-price-orders'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return []
}
function persistPriceOrders(list: PriceOrder[]) {
  try { localStorage.setItem('iiko-price-orders', JSON.stringify(list)) } catch { /* ignore */ }
}

// Выплаты сотрудникам (аванс/расчёт) — платёжная ведомость.
function loadSalary(): SalaryPayout[] {
  try { const raw = localStorage.getItem('iiko-salary'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return []
}
function persistSalary(list: SalaryPayout[]) {
  try { localStorage.setItem('iiko-salary', JSON.stringify(list)) } catch { /* ignore */ }
}

// Справочники Розничных продаж (раздел 03) — настраиваются в офисе, читаются кассой.
function loadPaymentTypes(): PaymentType[] {
  try { const raw = localStorage.getItem('iiko-payment-types'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return paymentTypesSeed.map((p) => ({ ...p }))
}
function persistPaymentTypes(list: PaymentType[]) {
  try { localStorage.setItem('iiko-payment-types', JSON.stringify(list)) } catch { /* ignore */ }
}
function loadCashOpTypes(): CashOpType[] {
  try { const raw = localStorage.getItem('iiko-cashop-types'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return cashOpTypeSeed.map((c) => ({ ...c }))
}
function persistCashOpTypes(list: CashOpType[]) {
  try { localStorage.setItem('iiko-cashop-types', JSON.stringify(list)) } catch { /* ignore */ }
}
function loadWriteoffReasons(): string[] {
  try { const raw = localStorage.getItem('iiko-writeoff-reasons'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return [...writeoffReasonSeed]
}
function persistWriteoffReasons(list: string[]) {
  try { localStorage.setItem('iiko-writeoff-reasons', JSON.stringify(list)) } catch { /* ignore */ }
}
// Дисконтная система (раздел 10): скидки/надбавки + клубные карты.
function loadDiscounts(): Discount[] {
  try { const raw = localStorage.getItem('iiko-discounts'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return discountSeed.map((d) => ({ ...d }))
}
function persistDiscounts(list: Discount[]) {
  try { localStorage.setItem('iiko-discounts', JSON.stringify(list)) } catch { /* ignore */ }
}
function loadClubCards(): ClubCard[] {
  try { const raw = localStorage.getItem('iiko-club-cards'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return clubCardSeed.map((c) => ({ ...c }))
}
function persistClubCards(list: ClubCard[]) {
  try { localStorage.setItem('iiko-club-cards', JSON.stringify(list)) } catch { /* ignore */ }
}
// Мотивационные программы + удержания (раздел 06).
function loadMotivation(): MotivationProgram[] {
  try { const raw = localStorage.getItem('iiko-motivation'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return motivationSeed.map((m) => ({ ...m }))
}
function persistMotivation(list: MotivationProgram[]) {
  try { localStorage.setItem('iiko-motivation', JSON.stringify(list)) } catch { /* ignore */ }
}
function loadDeductions(): SalaryDeduction[] {
  try { const raw = localStorage.getItem('iiko-deductions'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return []
}
function persistDeductions(list: SalaryDeduction[]) {
  try { localStorage.setItem('iiko-deductions', JSON.stringify(list)) } catch { /* ignore */ }
}

// ───────── мок-персист ОПЕРАТИВНОГО слоя (смена/заказы/банкеты/стоп-лист/документы/сообщения) ─────────
// Без бэка: чтобы при перезагрузке страницы (F5) ничего не терялось. Конфиг офиса хранится отдельными ключами.
// user/personalShift НЕ сохраняем — вход на кассе остаётся «свежим» (как на реальном терминале), но данные смены целы.
const RUNTIME_KEYS = [
  'cashShift', 'cashShiftSeq', 'orders', 'closedOrders', 'currentOrderId', 'orderSeq', 'fiscalSeq',
  'cashMovements', 'refunds', 'writeOffs', 'documents', 'docSeq', 'banquets', 'closedShifts', 'stopList',
  'messages', 'movementSeq', 'refundSeq', 'banquetSeq',
] as const
function loadRuntime(): Record<string, unknown> {
  try { const raw = localStorage.getItem('iiko-runtime'); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return {}
}
function persistRuntime(state: Record<string, unknown>) {
  try {
    const snap: Record<string, unknown> = {}
    for (const k of RUNTIME_KEYS) snap[k] = state[k]
    localStorage.setItem('iiko-runtime', JSON.stringify(snap))
  } catch { /* ignore */ }
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
  techCardOverrides: Record<string, TechCardItem[]> // техкарты из офиса (dishId → закладка)
  roleRights: Record<string, string[]> // карта должность→права (из офиса)
  messages: Message[] // внутренние сообщения / новости
  contractors: Contractor[] // поставщики (KZ, БИН/ИИН)
  invoices: Invoice[] // приходные накладные / входящие ЭСФ
  invSeq: number
  priceOrders: PriceOrder[] // приказы об изменении цен (Прейскурант)
  priceOrderSeq: number
  salaryPayouts: SalaryPayout[] // выплаты сотрудникам (аванс/расчёт)
  salaryPayoutSeq: number
  paymentTypes: PaymentType[] // типы оплат (Розничные продажи) — касса строит вкладки из активных
  cashOpTypes: CashOpType[]   // типы внесений/изъятий наличных
  writeoffReasons: string[]   // причины списания (акт списания)
  discounts: Discount[]       // скидки/надбавки (Дисконтная система)
  clubCards: ClubCard[]       // клубные (дисконтные) карты
  motivationPrograms: MotivationProgram[] // мотивационные программы (премии за продажи)
  salaryDeductions: SalaryDeduction[]     // штрафы/удержания сотрудникам
  deductionSeq: number
  demoAuto: boolean // авто-наполнение демо-заказами при запуске
  movementSeq: number
  refundSeq: number
  banquetSeq: number

  // auth / shifts
  login: (pin: string) => Staff | null
  loginByCard: (card: string) => Staff | null
  logout: () => void
  openPersonalShift: (position: string) => void
  closePersonalShift: () => void
  openCashShift: (openingCash?: number) => void
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
  setLineComment: (uid: string, comment: string) => void
  setLineCourse: (uid: string, course: number | undefined) => void
  setOrderWaiter: (orderId: number, waiter: string) => void
  setOrderType: (orderId: number, type: OrderType) => void
  setDiscount: (pct: number) => void
  setSurcharge: (pct: number) => void
  precheck: () => void
  fiscalizeOrder: () => void // фискальный чек до оплаты (9.x): печать ФД, заказ → стадия оплаты, стол не закрыт
  pay: (payments: PaymentSplit[], received: number) => ClosedOrder | null
  payByGuest: (guestNo: number, payments: PaymentSplit[], received: number) => ClosedOrder | null

  // деньги, возвраты, перенос, банкеты
  addCashMovement: (kind: 'in' | 'out', type: string, amount: number, comment: string) => void
  refundOrder: (receiptNo: string, sel: 'all' | string[] | { uid: string; qty: number }[], opts: { reason: string; restock: boolean; by: string; method: 'cash' | 'card' }) => Refund | null
  cashInDrawer: () => number // наличные в денежном ящике (для проверки возврата наличными)
  changePaymentType: (receiptNo: string, payments: PaymentSplit[]) => void
  moveOrderToTable: (orderId: number, tableId: string, hallId: string) => void
  mergeOrderInto: (sourceId: number, targetId: number) => void
  forceCloseOrder: (orderId: number) => void // принудительное закрытие незакрытого заказа из мастера смены
  addBanquet: (b: Omit<Banquet, 'id' | 'status'>) => void
  updateBanquet: (id: number, patch: Partial<Banquet>) => void
  setBanquetStatus: (id: number, status: BanquetStatus) => void
  addStop: (dishId: string, remaining?: number, scope?: string) => void
  removeStop: (dishId: string) => void
  setStopRemaining: (dishId: string, remaining: number) => void
  addStopOption: (optionId: string, name: string) => void // стоп модификатора (опции)
  removeStopOption: (optionId: string) => void
  clearStops: () => void // снять все с продажи
  can: (code: string) => boolean // право текущего пользователя (F_*) по его должности
  hasRightFor: (positions: string[] | undefined, code: string) => boolean // право для произвольных должностей
  toggleRoleRight: (position: string, code: string) => void // правка карты прав в офисе
  markMessageRead: (id: number) => void
  markAllMessagesRead: () => void
  replyMessage: (toTitle: string, text: string) => void
  addContractor: (name: string, bin: string) => void
  addPurchase: (supplierId: string, lines: InvoiceLine[]) => Invoice | null // приходная + ЭСФ + приход на склад
  addOutEsf: (buyerId: string, amount: number) => Invoice | null // исходящая ЭСФ покупателю
  createStoreDoc: (type: DocType, lines: DocLine[], opts?: { reason?: string; store?: string; toStore?: string; result?: string }) => StoreDoc
  setEstablishment: (patch: Partial<Establishment>) => void
  priceOf: (dishId: string, basePrice: number) => number // эффективная цена (оверрайд из офиса ?? базовая)
  setDishPrice: (dishId: string, price: number) => void  // правка цены в офисе
  setTechCard: (dishId: string, items: TechCardItem[]) => void // правка техкарты в офисе

  // сотрудники (карточки из офиса → вход на кассе)
  addStaff: (s: Omit<Staff, 'id'>) => void
  updateStaff: (id: string, patch: Partial<Omit<Staff, 'id'>>) => void
  removeStaff: (id: string) => void

  // прейскурант (приказы об изменении цен → активация уезжает на кассу)
  createPriceOrder: (lines: PriceOrderLine[], date: string, note: string) => PriceOrder | null
  activatePriceOrder: (id: number) => void

  // зарплата: выдача аванса/расчёта → изъятие наличных из кассы (связь офис↔касса)
  paySalary: (staffId: string, kind: 'advance' | 'settlement', amount: number) => void

  // справочники Розничных продаж (офис → касса)
  addPaymentType: (p: Omit<PaymentType, 'id'>) => void
  updatePaymentType: (id: string, patch: Partial<PaymentType>) => void
  removePaymentType: (id: string) => void
  addCashOpType: (c: Omit<CashOpType, 'id'>) => void
  removeCashOpType: (id: string) => void
  addWriteoffReason: (name: string) => void
  removeWriteoffReason: (name: string) => void
  // дисконтная система (офис → касса)
  addDiscount: (d: Omit<Discount, 'id'>) => void
  updateDiscount: (id: string, patch: Partial<Discount>) => void
  removeDiscount: (id: string) => void
  addClubCard: (c: Omit<ClubCard, 'id'>) => void
  removeClubCard: (id: string) => void
  // мотивация + удержания (зарплата)
  addMotivation: (m: Omit<MotivationProgram, 'id'>) => void
  updateMotivation: (id: string, patch: Partial<MotivationProgram>) => void
  removeMotivation: (id: string) => void
  addDeduction: (staffId: string, amount: number, reason: string) => void
  removeDeduction: (id: number) => void

  // склад
  receiveStock: (ingredientId: string, qty: number) => void // приход (приходная накладная, мок)
  setIngredientStock: (ingredientId: string, qty: number) => void // инвентаризация (выставить факт)
  resetStock: () => void // вернуть стартовые остатки

  // демо-данные (для показа без бэка)
  seedDemo: (count?: number) => void   // сгенерировать закрытые+открытые заказы за сегодня
  clearDemo: () => void                // очистить все заказы/возвраты/внесения
  setDemoAuto: (on: boolean) => void   // авто-наполнение при запуске
}

// восстановленный оперативный слой (если был сохранён) — спредится поверх дефолтов ниже
const RT = loadRuntime()
// продолжить счётчик uid строк заказа, чтобы новые строки не столкнулись с восстановленными (l1, l2…)
try {
  const restored = [...((RT.orders as Order[]) ?? []), ...((RT.closedOrders as ClosedOrder[]) ?? [])]
  let maxUid = 0
  for (const o of restored) for (const l of o.lines) { const n = parseInt(String(l.uid).replace(/^l/, ''), 10); if (n > maxUid) maxUid = n }
  if (maxUid >= uidSeq) uidSeq = maxUid + 1
} catch { /* ignore */ }

export const usePos = create<PosState>((set, get) => ({
  staffList: loadStaff(),
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
  techCardOverrides: loadTechCards(),
  roleRights: loadRoleRights(),
  messages: messagesSeed.map((m) => ({ ...m })),
  contractors: loadContractors(),
  invoices: loadInvoices(),
  invSeq: loadInvoices().length,
  priceOrders: loadPriceOrders(),
  priceOrderSeq: loadPriceOrders().length,
  salaryPayouts: loadSalary(),
  salaryPayoutSeq: loadSalary().length,
  paymentTypes: loadPaymentTypes(),
  cashOpTypes: loadCashOpTypes(),
  writeoffReasons: loadWriteoffReasons(),
  discounts: loadDiscounts(),
  clubCards: loadClubCards(),
  motivationPrograms: loadMotivation(),
  salaryDeductions: loadDeductions(),
  deductionSeq: loadDeductions().length,
  demoAuto: DEMO_AUTO,
  movementSeq: DEMO_INIT?.movementSeq ?? 0,
  refundSeq: 0,
  banquetSeq: initialBanquets.length,

  // восстановленный оперативный слой переопределяет дефолты/демо (если был сохранён)
  ...RT,

  login: (pin) => {
    const s = get().staffList.find((x) => x.pin === pin) ?? null
    if (s) set({ user: s })
    return s
  },
  loginByCard: (card) => {
    const s = get().staffList.find((x) => x.card && x.card === card) ?? null
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

  openCashShift: (openingCash = 0) => {
    const u = get().user
    set((st) => ({
      cashShift: { no: st.cashShiftSeq, openedAt: fullNow(), openedBy: u?.name ?? '', openingCash },
      // начальный остаток (разменный фонд) — внесение наличных в ящик на старте смены
      cashMovements: openingCash > 0
        ? [{ id: st.movementSeq + 1, kind: 'in' as const, type: 'Начальный остаток (разменный фонд)', amount: openingCash, comment: 'Открытие смены', at: fullNow() }, ...st.cashMovements]
        : st.cashMovements,
      movementSeq: openingCash > 0 ? st.movementSeq + 1 : st.movementSeq,
    }))
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
  setLineComment: (uid, comment) => set((st) => ({
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.map((l) => (l.uid === uid ? { ...l, comment: comment || undefined } : l)) } : o),
  })),
  setLineCourse: (uid, course) => set((st) => ({
    orders: st.orders.map((o) => o.id === st.currentOrderId
      ? { ...o, lines: o.lines.map((l) => (l.uid === uid ? { ...l, course } : l)) } : o),
  })),
  setOrderWaiter: (orderId, waiter) => set((st) => ({
    orders: st.orders.map((o) => (o.id === orderId ? { ...o, waiter } : o)),
  })),
  setOrderType: (orderId, type) => set((st) => ({
    orders: st.orders.map((o) => (o.id === orderId ? { ...o, type } : o)),
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
      const ingredients = applyWriteoff(st.ingredients, o.lines, st.techCardOverrides)
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
      const ingredients = applyWriteoff(st.ingredients, mine, st.techCardOverrides)
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

  refundOrder: (receiptNo, sel, opts) => {
    let closed = get().closedOrders.find((o) => o.fiscalDocNo === receiptNo)
    if (!closed) { // искать в архиве закрытых кассовых смен
      for (const sh of get().closedShifts) {
        const f = sh.orders.find((o) => o.fiscalDocNo === receiptNo)
        if (f) { closed = f; break }
      }
    }
    if (!closed) return null
    const co = closed
    const full = sel === 'all'
    // нормализуем выбор к карте «uid → возвращаемое количество» (поддержка дробного возврата)
    const qtyByUid: Record<string, number> = {}
    if (full) {
      for (const l of co.lines) qtyByUid[l.uid] = l.qty
    } else if (Array.isArray(sel) && sel.length > 0 && typeof sel[0] === 'object') {
      for (const s of sel as { uid: string; qty: number }[]) if (s.qty > 0) qtyByUid[s.uid] = s.qty
    } else {
      for (const uid of sel as string[]) { const l = co.lines.find((x) => x.uid === uid); if (l) qtyByUid[uid] = l.qty }
    }
    const uids = Object.keys(qtyByUid)
    if (uids.length === 0) return null
    // строки возврата, масштабированные на возвращаемое количество (для суммы и возврата на склад)
    const returnedLines = uids.map((uid) => { const l = co.lines.find((x) => x.uid === uid)!; return { ...l, qty: qtyByUid[uid] } })
    const amount = full
      ? co.total
      : +returnedLines.reduce((s, l) => s + lineTotal(l), 0).toFixed(2)
    const refund: Refund = {
      id: get().refundSeq + 1,
      orderId: co.id,
      fiscalDocNo: String(get().fiscalSeq + 1),
      amount, full, lineUids: uids, qtyByUid,
      reason: opts.reason, restock: opts.restock, method: opts.method,
      at: fullNow(), by: opts.by,
    }
    set((st) => {
      // «со списанием на склад» — возвращаем ингредиенты возвращённых позиций в остаток
      const ingredients = opts.restock ? applyRestock(st.ingredients, returnedLines, st.techCardOverrides) : st.ingredients
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

  // Принудительное закрытие незакрытого заказа из мастера закрытия смены.
  // В моке заказ просто снимается (отменяется) — в смену не переносится.
  forceCloseOrder: (orderId) =>
    set((st) => ({
      orders: st.orders.filter((o) => o.id !== orderId),
      currentOrderId: st.currentOrderId === orderId ? null : st.currentOrderId,
    })),

  addBanquet: (b) =>
    set((st) => ({
      banquets: [{ ...b, id: st.banquetSeq + 1, status: 'Действует' }, ...st.banquets],
      banquetSeq: st.banquetSeq + 1,
    })),

  updateBanquet: (id, patch) =>
    set((st) => ({ banquets: st.banquets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),

  setBanquetStatus: (id, status) =>
    set((st) => ({ banquets: st.banquets.map((b) => (b.id === id ? { ...b, status } : b)) })),

  addStop: (dishId, remaining, scope) =>
    set((st) => (st.stopList.some((s) => s.dishId === dishId)
      ? st
      : { stopList: [...st.stopList, { dishId, remaining, scope, byName: st.user?.name ?? '—', at: fullNow() }] })),
  removeStop: (dishId) =>
    set((st) => ({ stopList: st.stopList.filter((s) => s.dishId !== dishId) })),
  setStopRemaining: (dishId, remaining) =>
    set((st) => ({ stopList: st.stopList.map((s) => (s.dishId === dishId && !s.optionId ? { ...s, remaining } : s)) })),
  addStopOption: (optionId, name) =>
    set((st) => (st.stopList.some((s) => s.optionId === optionId)
      ? st
      : { stopList: [...st.stopList, { dishId: '', optionId, name, byName: st.user?.name ?? '—', at: fullNow() }] })),
  removeStopOption: (optionId) =>
    set((st) => ({ stopList: st.stopList.filter((s) => s.optionId !== optionId) })),
  clearStops: () => set({ stopList: [] }),
  can: (code) => hasRightIn(get().roleRights, get().user?.positions, code),
  cashInDrawer: () => {
    const st = get()
    const cashIn = st.cashMovements.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0)
    const cashOut = st.cashMovements.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0)
    const cashPaid = st.closedOrders.reduce((s, o) => s + o.payments.filter((p) => p.paymentTypeId === 'p-cash').reduce((a, p) => a + p.amount, 0), 0)
    const cashRefunds = st.refunds.filter((r) => r.method !== 'card').reduce((s, r) => s + r.amount, 0)
    return +(cashIn + cashPaid - cashOut - cashRefunds).toFixed(2)
  },
  hasRightFor: (positions, code) => hasRightIn(get().roleRights, positions, code),
  markMessageRead: (id) => set((st) => ({ messages: st.messages.map((m) => (m.id === id ? { ...m, unread: false } : m)) })),
  markAllMessagesRead: () => set((st) => ({ messages: st.messages.map((m) => (m.unread ? { ...m, unread: false } : m)) })),
  replyMessage: (toTitle, text) => set((st) => {
    const id = st.messages.reduce((mx, m) => Math.max(mx, m.id), 0) + 1
    const reply: Message = { id, from: st.user?.name ?? 'Сотрудник', date: fullNow(), title: `Re: ${toTitle}`, body: text, unread: false, outgoing: true }
    return { messages: [reply, ...st.messages] }
  }),

  addContractor: (name, bin) => set((st) => {
    if (!name || !bin || st.contractors.some((c) => c.bin === bin)) return st
    const contractors = [...st.contractors, { id: 'c-' + bin, name, bin }]
    try { localStorage.setItem('iiko-contractors', JSON.stringify(contractors)) } catch { /* ignore */ }
    return { contractors }
  }),
  // Приходная накладная (KZ): создаёт входящую ЭСФ + приходует ингредиенты на склад.
  addPurchase: (supplierId, lines) => {
    const sup = get().contractors.find((c) => c.id === supplierId)
    if (!sup || lines.length === 0) return null
    const total = +lines.reduce((s, l) => s + l.qty * l.price, 0).toFixed(2)
    const vat = +(total - total / 1.16).toFixed(2) // ҚҚС 16% в т.ч.
    const n = get().invSeq + 1
    const inv: Invoice = { id: n, no: `ПН-${1000 + n}`, date: fullNow(), supplierName: sup.name, supplierBin: sup.bin, lines, total, vat, esfNo: `ESF-KZ-${100000 + n}`, kind: 'in' }
    set((st) => {
      const ingredients = st.ingredients.map((i) => { const l = lines.find((x) => x.ingredientId === i.id); return l ? { ...i, stock: +(i.stock + l.qty).toFixed(3) } : i })
      persistIngredients(ingredients)
      const invoices = [inv, ...st.invoices]
      try { localStorage.setItem('iiko-invoices', JSON.stringify(invoices)) } catch { /* ignore */ }
      return { invoices, invSeq: n, ingredients }
    })
    return inv
  },
  addOutEsf: (buyerId, amount) => {
    const b = get().contractors.find((c) => c.id === buyerId)
    if (!b || !(amount > 0)) return null
    const n = get().invSeq + 1
    const total = +amount.toFixed(2)
    const vat = +(total - total / 1.16).toFixed(2)
    const inv: Invoice = { id: n, no: `ЭСФ-OUT-${1000 + n}`, date: fullNow(), supplierName: b.name, supplierBin: b.bin, lines: [], total, vat, esfNo: `ESF-OUT-${100000 + n}`, kind: 'out' }
    set((st) => {
      const invoices = [inv, ...st.invoices]
      try { localStorage.setItem('iiko-invoices', JSON.stringify(invoices)) } catch { /* ignore */ }
      return { invoices, invSeq: n }
    })
    return inv
  },
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
      store: opts?.store ?? 'Основной', toStore: opts?.toStore, result: opts?.result, reason: opts?.reason, lines,
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
  setTechCard: (dishId, items) => set((st) => {
    const next = { ...st.techCardOverrides, [dishId]: items }
    try { localStorage.setItem('iiko-techcards', JSON.stringify(next)) } catch { /* ignore */ }
    return { techCardOverrides: next }
  }),

  // сотрудники: карточки правятся в офисе, вход на кассе (login) идёт по этому списку
  addStaff: (s) => set((st) => {
    const id = 's-' + (s.name.toLowerCase().replace(/\s+/g, '-') || 'new') + '-' + (st.staffList.length + 1)
    const list = [...st.staffList, { ...s, id }]
    persistStaff(list)
    return { staffList: list }
  }),
  updateStaff: (id, patch) => set((st) => {
    const list = st.staffList.map((x) => (x.id === id ? { ...x, ...patch } : x))
    persistStaff(list)
    // если правят текущего пользователя — синхронизируем
    const user = st.user?.id === id ? { ...st.user, ...patch } : st.user
    return { staffList: list, user }
  }),
  removeStaff: (id) => set((st) => {
    const list = st.staffList.filter((x) => x.id !== id)
    persistStaff(list)
    return { staffList: list }
  }),

  // прейскурант: приказ создаётся черновиком; активация записывает новые цены в priceOverrides (касса читает priceOf)
  createPriceOrder: (lines, date, note) => {
    if (lines.length === 0) return null
    const n = get().priceOrderSeq + 1
    const order: PriceOrder = { id: n, no: `ПР-${1000 + n}`, date, note, status: 'draft', lines, createdAt: fullNow() }
    set((st) => {
      const list = [order, ...st.priceOrders]
      persistPriceOrders(list)
      return { priceOrders: list, priceOrderSeq: n }
    })
    return order
  },
  activatePriceOrder: (id) => set((st) => {
    const order = st.priceOrders.find((o) => o.id === id)
    if (!order) return {}
    const prices = { ...st.priceOverrides }
    for (const l of order.lines) prices[l.dishId] = l.newPrice
    try { localStorage.setItem('iiko-menu-prices', JSON.stringify(prices)) } catch { /* ignore */ }
    const list = st.priceOrders.map((o) => (o.id === id ? { ...o, status: 'active' as const } : o))
    persistPriceOrders(list)
    return { priceOverrides: prices, priceOrders: list }
  }),

  // Выдача аванса/расчёта сотруднику. Фактическая выдача = изъятие наличных из кассы
  // (тип содержит «зарплат» → попадает в отчёт 038 и пересчёт смены). Ведомость персистится отдельно.
  paySalary: (staffId, kind, amount) => {
    if (!(amount > 0)) return
    set((st) => {
      const by = st.user?.name ?? 'Офис'
      const payout: SalaryPayout = { id: st.salaryPayoutSeq + 1, staffId, kind, amount, at: fullNow(), by }
      const list = [payout, ...st.salaryPayouts]
      persistSalary(list)
      const name = st.staffList.find((s) => s.id === staffId)?.name ?? ''
      const type = kind === 'advance' ? 'Выдача аванса (зарплата)' : 'Выплата зарплаты'
      return {
        salaryPayouts: list,
        salaryPayoutSeq: st.salaryPayoutSeq + 1,
        cashMovements: [{ id: st.movementSeq + 1, kind: 'out' as const, type, amount, comment: name, at: fullNow() }, ...st.cashMovements],
        movementSeq: st.movementSeq + 1,
      }
    })
  },

  // справочники Розничных продаж (офис) → касса читает из стора
  addPaymentType: (p) => set((st) => {
    const id = 'p-' + (p.code?.toLowerCase() || 'custom') + '-' + (st.paymentTypes.length + 1)
    const list = [...st.paymentTypes, { ...p, id }]
    persistPaymentTypes(list)
    return { paymentTypes: list }
  }),
  updatePaymentType: (id, patch) => set((st) => {
    const list = st.paymentTypes.map((p) => (p.id === id ? { ...p, ...patch } : p))
    persistPaymentTypes(list)
    return { paymentTypes: list }
  }),
  removePaymentType: (id) => set((st) => {
    const list = st.paymentTypes.filter((p) => p.id !== id)
    persistPaymentTypes(list)
    return { paymentTypes: list }
  }),
  addCashOpType: (c) => set((st) => {
    const id = (c.direction === 'in' ? 'ci-' : 'co-') + (st.cashOpTypes.length + 1)
    const list = [...st.cashOpTypes, { ...c, id }]
    persistCashOpTypes(list)
    return { cashOpTypes: list }
  }),
  removeCashOpType: (id) => set((st) => {
    const list = st.cashOpTypes.filter((c) => c.id !== id)
    persistCashOpTypes(list)
    return { cashOpTypes: list }
  }),
  addWriteoffReason: (name) => set((st) => {
    const n = name.trim()
    if (!n || st.writeoffReasons.includes(n)) return st
    const list = [...st.writeoffReasons, n]
    persistWriteoffReasons(list)
    return { writeoffReasons: list }
  }),
  removeWriteoffReason: (name) => set((st) => {
    const list = st.writeoffReasons.filter((r) => r !== name)
    persistWriteoffReasons(list)
    return { writeoffReasons: list }
  }),

  addDiscount: (d) => set((st) => {
    const id = 'd-' + (st.discounts.length + 1) + '-' + Math.floor(d.percent)
    const list = [...st.discounts, { ...d, id }]
    persistDiscounts(list)
    return { discounts: list }
  }),
  updateDiscount: (id, patch) => set((st) => {
    const list = st.discounts.map((d) => (d.id === id ? { ...d, ...patch } : d))
    persistDiscounts(list)
    return { discounts: list }
  }),
  removeDiscount: (id) => set((st) => {
    const list = st.discounts.filter((d) => d.id !== id)
    persistDiscounts(list)
    return { discounts: list }
  }),
  addClubCard: (c) => set((st) => {
    if (!c.number.trim() || st.clubCards.some((x) => x.number === c.number)) return st
    const id = 'card-' + (st.clubCards.length + 1)
    const list = [...st.clubCards, { ...c, id }]
    persistClubCards(list)
    return { clubCards: list }
  }),
  removeClubCard: (id) => set((st) => {
    const list = st.clubCards.filter((c) => c.id !== id)
    persistClubCards(list)
    return { clubCards: list }
  }),

  addMotivation: (m) => set((st) => {
    const id = 'm-' + (st.motivationPrograms.length + 1)
    const list = [...st.motivationPrograms, { ...m, id }]
    persistMotivation(list)
    return { motivationPrograms: list }
  }),
  updateMotivation: (id, patch) => set((st) => {
    const list = st.motivationPrograms.map((m) => (m.id === id ? { ...m, ...patch } : m))
    persistMotivation(list)
    return { motivationPrograms: list }
  }),
  removeMotivation: (id) => set((st) => {
    const list = st.motivationPrograms.filter((m) => m.id !== id)
    persistMotivation(list)
    return { motivationPrograms: list }
  }),
  addDeduction: (staffId, amount, reason) => set((st) => {
    if (!(amount > 0)) return st
    const item = { id: st.deductionSeq + 1, staffId, amount, reason: reason || 'Удержание', at: fullNow() }
    const list = [item, ...st.salaryDeductions]
    persistDeductions(list)
    return { salaryDeductions: list, deductionSeq: st.deductionSeq + 1 }
  }),
  removeDeduction: (id) => set((st) => {
    const list = st.salaryDeductions.filter((d) => d.id !== id)
    persistDeductions(list)
    return { salaryDeductions: list }
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

// Автосохранение оперативного слоя при любом изменении (мок-персист без бэка → ничего не теряется на reload).
usePos.subscribe((s) => persistRuntime(s as unknown as Record<string, unknown>))
