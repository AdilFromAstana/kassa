// Доменный клиент (Level 2): вызовы бизнес-эндпоинтов бэка (не compat config/runtime).
// Срабатывает только если вошли (есть JWT). Иначе no-op → мок работает локально как раньше (фолбэк).
import { getToken } from './auth'
import { getTradePoint } from './activePoint'
import type { Order, PaymentSplit } from '../types'

const env = (import.meta as unknown as { env?: Record<string, string> }).env
const BASE = env?.VITE_API_BASE ?? '/api'

async function call<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T | null> {
  const token = getToken()
  if (!token) return null // не вошли в бэк → локальный мок остаётся источником
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    return res.ok ? ((await res.json().catch(() => ({}))) as T) : null
  } catch { return null }
}
const post = <T>(path: string, body: unknown) => call<T>('POST', path, body)
const put = <T>(path: string, body: unknown) => call<T>('PUT', path, body)
async function del(path: string): Promise<boolean> {
  const token = getToken()
  if (!token) return false
  try { const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); return res.ok } catch { return false }
}

async function get<T>(path: string): Promise<T | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as T) : null
  } catch { return null }
}

// Серверные отчёты (чтение из фактов бэка).
export interface ServerSales { checks: number; revenue: number; avgCheck: number }
export const reportSales = () => get<ServerSales>(`/office/points/${getTradePoint()}/reports/sales`)

export interface ServerPnl { revenueGross: number; vat: number; revenueNet: number; cogs: number; grossProfit: number; operatingProfit: number }
export const reportPnl = () => get<ServerPnl>(`/office/points/${getTradePoint()}/reports/pnl`)

export interface ServerBalance { totalDebitMovements: number; totalCreditMovements: number; accounts: { code: string; name: string; kind: string; balance: number }[] }
export const reportBalance = () => get<ServerBalance>(`/office/points/${getTradePoint()}/reports/balance`)

// Остальные витрины отчётов (всё с сервера): разрезы выручки, по блюдам, непродаваемые, ҚҚС, закупки, товарная ОСВ, остатки.
export interface ServerReportsExtra {
  byDish: { dishId: string; name: string; qty: number; revenue: number; cogs: number; margin: number }[]
  byCategory: { categoryId: string; name: string; revenue: number }[]
  byWaiter: { waiter: string; checks: number; revenue: number }[]
  byDay: { day: string; checks: number; revenue: number }[]
  byHour: { hour: string; revenue: number }[]
  unsold: { id: string; name: string; groupId: string }[]
  vat: { collected: number; input: number; toPay: number }
  purchases: { count: number; total: number; vat: number; items: { no: string; date: string; supplierName: string; total: number; vat: number; paid: boolean }[] }
  turnover: { ingredientId: string; name: string; opening: number; in: number; out: number; closing: number; cost: number }[]
  stock: { ingredientId: string; name: string; warehouse: string; qty: number; cost: number }[]
}
export const reportExtra = () => get<ServerReportsExtra>(`/office/points/${getTradePoint()}/reports/extra`)

// Каталог блюд с бэка с эффективной ценой точки (база сети или оверрайд ТП).
export interface CatalogDish { id: string; price: number; basePrice: number }
export const catalogDishes = () => get<CatalogDish[]>(`/catalog/dishes`)

// Остатки склада точки с бэка (для синхронизации остатков кассы).
export interface CatalogStock { ingredientId: string; warehouse: string; qty: number; cost: number }
export const catalogStock = () => get<CatalogStock[]>(`/catalog/stock`)

// Полная структура меню с бэка (группы/блюда/модификаторы) — для гидратации mock/menu.ts.
export interface CatalogMenu {
  groups: { id: string; name: string; page: number }[]
  modifierGroups: { id: string; name: string; min: number; max: number; options: { id: string; name: string; price: number }[] }[]
  dishes: { id: string; code: string; name: string; price: number; vat: number; groupId: string; color?: string | null; isWeight?: boolean | null; modifierGroupIds?: string[] }[]
}
export const catalogMenu = () => get<CatalogMenu>(`/catalog/menu`)

// Мастер первого запуска: засеять стартовый каталог сети (идемпотентно на бэке).
export const seedCatalogTemplate = () => post<{ seeded: boolean; dishes?: number; groups?: number }>('/office/catalog/seed-template', {})

// Ассортимент точки (point_dish): какие блюда сети продаются на активной точке.
export interface AssortmentDish { id: string; name: string; groupId: string; active: boolean }
export const getAssortment = () => get<AssortmentDish[]>(`/office/points/${getTradePoint()}/assortment`)
export const setAssortment = (dishId: string, active: boolean) =>
  put(`/office/points/${getTradePoint()}/assortment/${encodeURIComponent(dishId)}`, { active })

// Внесение / изъятие наличных → POST /api/cash/movements (право F_CASH).
export const cashMovement = (kind: 'in' | 'out', type: string, amount: number, comment: string) =>
  post('/cash/movements', { kind, type, amount, comment })

// Смена: открыть/закрыть на сервере (права F_OCS / F_CS).
export const shiftOpen = (openingCash: number) => post('/shift/open', { openingCash })
export const shiftClose = () => post('/shift/close', {})

// Возврат чека на сервере по фискальному номеру (право F_STRN). receiptNo = серверный fiscalDocNo.
export const refund = (receiptNo: string, full: boolean, lineUids: string[], reason: string, restock: boolean, method: 'cash' | 'card') =>
  post('/refunds', { receiptNo, full, lineUids, reason, restock, method })

// Оплата чека → POST /api/orders/checkout (создать+оплатить на сервере: фискал + списание склада).
export const checkout = (o: Order, payments: PaymentSplit[], received: number) =>
  post('/orders/checkout', {
    tableId: o.tableId, hallId: o.hallId, guests: o.guests, type: o.type,
    lines: o.lines.map((l) => ({
      dishId: l.dishId, name: l.name, price: l.price, vat: l.vat, qty: l.qty, discountPct: l.discountPct,
      modifiers: l.modifiers.map((m) => ({ optionId: m.optionId, name: m.name, price: m.price, qty: m.qty })),
    })),
    discountPct: o.discountPct, surchargePct: o.surchargePct, serviceChargePct: o.serviceChargePct, discountAmount: o.discountAmount,
    payments: payments.map((p) => ({ paymentTypeId: p.paymentTypeId, amount: p.amount })), received,
  })

// Офис: цена блюда на точке → PUT /api/office/points/{tp}/prices/{dishId} (право B_ROMENOR).
export const setPrice = (dishId: string, price: number) =>
  put(`/office/points/${getTradePoint()}/prices/${encodeURIComponent(dishId)}`, { price })

// Офис: создать сотрудника (сеть) + назначение на точку с PIN (право B_EE).
export const createStaff = async (name: string, pin: string, positions: string[], card?: string) => {
  const emp = await post<{ id: string }>('/office/employees', { name, tabNo: null, card: card ?? null })
  if (!emp?.id) return null
  return post(`/office/points/${getTradePoint()}/staff`, { employeeId: emp.id, pin, positions })
}

// ───────── ВОЛНА 1: КАРТЫ (PUT заменяет все строки на сервере) ─────────
// Каждая отправляет ВЕСЬ объект-карту; сервер делает RemoveRange+Add. No-op без JWT.
export const putRoleRights = (map: Record<string, string[]>) => put('/office/role-rights', map)
export const putTechcards = (map: Record<string, { ingredientId: string; gross: number; coldLossPct?: number; hotLossPct?: number }[]>) => put('/office/techcards', map)
export const putCategoryPrices = (map: Record<string, Record<string, number>>) => put(`/office/points/${getTradePoint()}/category-prices`, map)
export const putPayProfiles = (map: Record<string, { mode?: string; oklad?: number; rate?: number }>) => put(`/office/points/${getTradePoint()}/pay-profiles`, map)
export const putMedChecks = (map: Record<string, string>) => put(`/office/points/${getTradePoint()}/med-checks`, map)
export const putShiftSchedule = (map: Record<string, Record<string, string>>) => put(`/office/points/${getTradePoint()}/shift-schedule`, map)
export const putSetting = (key: string, val: unknown) => put(`/office/points/${getTradePoint()}/settings/${encodeURIComponent(key)}`, val)

// ───────── ВОЛНА 1: СИНГЛТОНЫ (GET/PUT, одна строка на сеть/точку) ─────────
export const putLoyaltyProgram = (p: unknown) => put('/office/loyalty-program', p)
export const putDepositProgram = (p: unknown) => put('/office/deposit-program', p)
export const putEstablishment = (e: unknown) => put(`/office/points/${getTradePoint()}/establishment`, e)

// ───────── ВОЛНА 2: справочники-списки (сеть). Полная синхронизация: upsert каждого + удаление отсутствующих на сервере. ─────────
// Делает целостной картину (add/edit/delete), а не только upsert. No-op без JWT.
async function syncRef(path: string, list: { id: string }[]): Promise<void> {
  const token = getToken(); if (!token) return
  for (const it of list) await post(`/office/${path}`, it)
  const server = (await get<{ id: string }[]>(`/office/${path}`)) ?? []
  const keep = new Set(list.map((x) => x.id))
  for (const s of server) if (s?.id != null && !keep.has(s.id)) await del(`/office/${path}/${encodeURIComponent(s.id)}`)
}
export const syncPaymentTypes = (l: { id: string }[]) => syncRef('payment-types', l)
export const syncOrderTypes = (l: { id: string }[]) => syncRef('order-types', l)
export const syncCashOpTypes = (l: { id: string }[]) => syncRef('cashop-types', l)
export const syncWriteoffReasons = (l: string[]) => syncRef('writeoff-reasons', l.map((r) => ({ id: r, name: r })))
export const syncShiftTypes = (l: { id: string }[]) => syncRef('shift-types', l)
export const syncDiscounts = (l: { id: string }[]) => syncRef('discounts', l)
export const syncClubCards = (l: { id: string }[]) => syncRef('club-cards', l)
export const syncCertificates = (l: { id: string }[]) => syncRef('certificates', l)
export const syncPromoActions = (l: { id: string }[]) => syncRef('promo-actions', l)
export const syncMotivation = (l: { id: string }[]) => syncRef('motivation', l)
export const syncContractors = (l: { id: string }[]) => syncRef('contractors', l)
export const syncPriceCategories = (l: { id: string }[]) => syncRef('price-categories', l)
export const syncLoyaltyCards = (l: { id: string }[]) => syncRef('loyalty-cards', l)
export const syncConcepts = (l: { id: string }[]) => syncRef('concepts', l)

// Точечные справочники (скоуп точки): тот же приём через /office/points/{tp}/{path}.
async function syncRefPoint(path: string, list: { id: string }[]): Promise<void> {
  const token = getToken(); if (!token) return
  const base = `/office/points/${getTradePoint()}/${path}`
  for (const it of list) await post(base, it)
  const server = (await get<{ id: string }[]>(base)) ?? []
  const keep = new Set(list.map((x) => x.id))
  for (const s of server) if (s?.id != null && !keep.has(s.id)) await del(`${base}/${encodeURIComponent(s.id)}`)
}
export const syncLicenses = (l: { id: string }[]) => syncRefPoint('licenses', l)
export const syncPrintTemplates = (l: { id: string }[]) => syncRefPoint('print-templates', l)
export const syncInputDevices = (l: { id: string }[]) => syncRefPoint('input-devices', l)
export const syncCouriers = (l: { id: string }[]) => syncRefPoint('couriers', l)
export const syncDeliveryCustomers = (l: { id: string }[]) => syncRefPoint('delivery-customers', l)
export const putDeliverySettings = (s: unknown) => put(`/office/points/${getTradePoint()}/delivery-settings`, s)

// ───────── ВОЛНА 3: рантайм точки (числовой Id, POST=upsert по точке) + приказы цен ─────────
export const postBanquet = (b: { id: number }) => post(`/points/${getTradePoint()}/banquets`, b)
export const postMessage = (m: { id: number }) => post(`/points/${getTradePoint()}/messages`, m)
// SalaryPayout/Deduction: фронт хранит staffId, бэк ждёт employeeId → маппинг.
export const postSalaryPayout = (p: { id: number; staffId: string; kind: string; amount: number; at: string; by: string }) =>
  post(`/office/points/${getTradePoint()}/salary`, { id: p.id, employeeId: p.staffId, kind: p.kind, amount: p.amount, at: p.at, by: p.by })
export const postDeduction = (d: { id: number; staffId: string; amount: number; reason: string; at: string }) =>
  post(`/office/points/${getTradePoint()}/deductions`, { id: d.id, employeeId: d.staffId, amount: d.amount, reason: d.reason, at: d.at })
export const postStoreDoc = (doc: { id: number }) => post(`/office/points/${getTradePoint()}/store-docs`, doc)
export const postPriceOrder = (o: { id: number }) => post(`/office/points/${getTradePoint()}/price-orders`, o)
export const activatePriceOrder = (id: number) => post(`/office/points/${getTradePoint()}/price-orders/${id}/activate`, {})

// Стоп-лист: ключ dishId/optionId (на фронте нет числового Id). upsert + удаление.
export const postStop = (s: { dishId?: string; optionId?: string; name?: string; remaining?: number; scope?: string; byName?: string; at?: string }) =>
  post(`/points/${getTradePoint()}/stoplist`, s)
export const delStop = (q: { dishId?: string; optionId?: string }) => {
  const p = new URLSearchParams()
  if (q.dishId != null) p.set('dishId', q.dishId)
  if (q.optionId != null) p.set('optionId', q.optionId)
  return del(`/points/${getTradePoint()}/stoplist?${p.toString()}`)
}
export const clearStopsApi = () => del(`/points/${getTradePoint()}/stoplist`)
