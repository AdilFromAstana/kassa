import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Monitor, Trash2, Plus } from 'lucide-react'
import { usePos, lineTotal, DEFAULT_OKLAD, DEFAULT_HOUR_RATE, defaultPayMode } from '../store/pos'
import { printToast } from '../lib/print'
import { menuGroups, dishesByGroup, dishes, findDish } from '../mock/menu'
import { attendance, warehouses } from '../mock/data'
import OfficeDelivery from './OfficeDelivery'
import OfficeCorp from './OfficeCorp'
import OfficeLedger from './OfficeLedger'
import OfficeOlap from './OfficeOlap'
import OfficeLoyalty from './OfficeLoyalty'
import OfficeJournal from './OfficeJournal'
import OfficeAdmin from './OfficeAdmin'
import { techCards, dishCost, dishMaxPortions, itemNetto, itemYield, dishYield } from '../mock/warehouse'
import { RIGHTS, POSITIONS, RIGHT_GROUPS } from '../lib/rights'
import { formatTenge, vatBreakdown } from '../lib/money'
import { downloadExcel, xlsNum } from '../lib/export'
import { todayISO, formatRu, fromISO, toISO, addDaysISO } from '../lib/date'
import CalendarModal from '../components/CalendarModal'
import InputModal from '../components/InputModal'
import Tabs from '../components/Tabs'
import type { Establishment, PriceOrderLine, PaymentKind, OrderType, VatRate } from '../types'

// iikoOffice (мок бэк-офиса) — здесь редактируется конфиг заведения и меню/цены, которые «уезжают»
// на кассу (Front). Общий стор + localStorage: изменения применяются на кассе сразу.
// Разделы: Настройки заведения, Меню и цены. Остальное (номенклатура/сотрудники/отчёты) — на будущее.
const FLAGS: { key: keyof Establishment; label: string; note: string }[] = [
  { key: 'precheck', label: 'Печать пречека', note: 'кнопка «Пречек» (ресторан)' },
  { key: 'comments', label: 'Комментарии', note: 'комментарий к заказу/блюду' },
  { key: 'courses', label: 'Курсы подачи', note: 'панель «Курсы»' },
  { key: 'tab', label: 'Барный таб', note: 'открытый счёт у стойки' },
  { key: 'mix', label: 'MIX / составное', note: 'комбо/составные блюда' },
  { key: 'kitchenScreen', label: 'Кухонный экран (KDS)', note: '«Вне очереди», печать на кухню' },
  { key: 'banquets', label: 'Банкеты и резервы', note: 'раздел «Банкеты» на кассе' },
  { key: 'delivery', label: 'Доставка (iikoDelivery)', note: 'адрес, курьеры' },
  { key: 'iikoCard', label: 'iikoCard (лояльность)', note: 'бонусы в оплате' },
  { key: 'fiscalBeforePay', label: 'Фискальный чек до оплаты', note: 'печать ФД перед приёмом денег (9.x)' },
]

type Section = 'corp' | 'settings' | 'menu' | 'prikazy' | 'retail' | 'discount' | 'loyalty' | 'delivery' | 'staff' | 'stock' | 'reports' | 'accounting' | 'payroll' | 'finance' | 'journal' | 'admin'
const NAV: { id: Section; label: string }[] = [
  { id: 'corp', label: 'Корпорация' },
  { id: 'settings', label: 'Настройки заведения' },
  { id: 'menu', label: 'Меню и цены' },
  { id: 'prikazy', label: 'Прейскурант (приказы)' },
  { id: 'retail', label: 'Розничные продажи' },
  { id: 'discount', label: 'Дисконтная система' },
  { id: 'loyalty', label: 'iikoCard (лояльность)' },
  { id: 'delivery', label: 'Доставка (iikoDelivery)' },
  { id: 'staff', label: 'Сотрудники и права' },
  { id: 'stock', label: 'Номенклатура и техкарты' },
  { id: 'accounting', label: 'Бухгалтерия (KZ)' },
  { id: 'payroll', label: 'Зарплата (KZ)' },
  { id: 'finance', label: 'Финансы (касс. книга / ДДС)' },
  { id: 'reports', label: 'Отчёты' },
  { id: 'journal', label: 'Журнал событий' },
  { id: 'admin', label: 'Администрирование' },
]
const SECTION_TITLE: Record<Section, string> = {
  corp: 'Корпорация — структура сети, настройки, нумерация, концепции, синхронизация',
  settings: 'Настройки торгового предприятия', menu: 'Меню и цены', prikazy: 'Прейскурант — приказы об изменении цен',
  retail: 'Розничные продажи — типы оплат, внесений/изъятий, причины списания, типы заказов',
  discount: 'Дисконтная система — скидки/надбавки и клубные карты',
  loyalty: 'iikoCard — лояльность: бонусы (конструктор акций), депозит-кошелёк, сертификаты, карты гостей',
  delivery: 'Доставка (iikoDelivery) — заказы, клиенты, курьеры, справочники, отчёты',
  staff: 'Сотрудники и права', stock: 'Номенклатура и техкарты', accounting: 'Бухгалтерия (KZ)', payroll: 'Зарплата (KZ)', reports: 'Отчёты',
  finance: 'Финансы — кассовая книга и ДДС (движение денежных средств)',
  journal: 'Журнал событий — монитор операций',
  admin: 'Администрирование — лицензии, печатные формы, устройства, обслуживание БД',
}

// 🇰🇿 Зарплатные налоги/отчисления РК на 2026 (источник: kgd.gov.kz, mybuh.kz). МРП 4 325 ₸, МЗП 85 000 ₸.
// Удержания с работника: ОПВ 10%, ВОСМС 2%, ИПН 10% (после вычета ОПВ+ВОСМС+30 МРП).
// За счёт работодателя: ОПВР 3,5%, ООСМС 3%, СО 5% (от оклада−ОПВ), соцналог 6% (от оклада−ОПВ−ВОСМС) за вычетом СО.
const MRP_2026 = 4325
const MZP_2026 = 85000
function kzTax(okl: number) {
  const opv = Math.round(Math.min(okl, 50 * MZP_2026) * 0.10)      // макс. база 50 МЗП
  const vosms = Math.round(Math.min(okl, 20 * MZP_2026) * 0.02)    // макс. база 20 МЗП
  const ipn = Math.round(Math.max(0, okl - opv - vosms - 30 * MRP_2026) * 0.10) // вычет 30 МРП
  const net = okl - opv - vosms - ipn                              // на руки
  const opvr = Math.round(okl * 0.035)                             // взнос работодателя
  const oosms = Math.round(okl * 0.03)                             // ОСМС работодателя
  const so = Math.round((okl - opv) * 0.05)                        // соц. отчисления
  const sn = Math.max(0, Math.round((okl - opv - vosms) * 0.06) - so) // соцналог за вычетом СО
  const employerCost = okl + opvr + oosms + so + sn                // полная стоимость для работодателя
  return { opv, vosms, ipn, net, opvr, oosms, so, sn, employerCost }
}

// Роли офиса (как в iikoOffice) → доступные разделы. Гейтит сайдбар.
const OFFICE_ROLES = ['Администратор', 'Управляющий', 'Бухгалтер']
const ROLE_SECTIONS: Record<string, Section[]> = {
  'Администратор': ['corp', 'settings', 'menu', 'prikazy', 'retail', 'discount', 'loyalty', 'delivery', 'staff', 'stock', 'accounting', 'payroll', 'finance', 'reports', 'journal', 'admin'],
  'Управляющий': ['corp', 'settings', 'menu', 'prikazy', 'retail', 'discount', 'loyalty', 'delivery', 'stock', 'accounting', 'payroll', 'finance', 'reports', 'journal'],
  'Бухгалтер': ['accounting', 'payroll', 'finance', 'reports', 'stock'],
}

export default function OfficeScreen() {
  const navigate = useNavigate()
  const { establishment: est, setEstablishment, priceOf, setDishPrice, roleRights, toggleRoleRight,
    priceOverrides, priceCategories, categoryPrices, setCategoryPrice, addPriceCategory, removePriceCategory,
    ingredients, receiveStock, setIngredientStock, closedOrders, refunds, documents,
    techCardOverrides, setTechCard, contractors, invoices, addContractor, addPurchase, addOutEsf,
    staffList, addStaff, updateStaff, removeStaff, priceOrders, createPriceOrder, activatePriceOrder, applyDuePriceOrders,
    salaryPayouts, paySalary, cashMovements, writeOffs, cashShift,
    paymentTypes, addPaymentType, updatePaymentType, removePaymentType,
    orderTypes, addOrderType, updateOrderType, removeOrderType, setDefaultOrderType,
    shiftTypes, addShiftType, removeShiftType, medChecks, setMedCheck, payProfiles, setPayProfile,
    cashOpTypes, addCashOpType, removeCashOpType, writeoffReasons, addWriteoffReason, removeWriteoffReason,
    discounts, addDiscount, updateDiscount, removeDiscount, clubCards, addClubCard, removeClubCard,
    motivationPrograms, addMotivation, updateMotivation, removeMotivation, salaryDeductions, addDeduction, removeDeduction } = usePos()
  const [section, setSection] = useState<Section>('settings')
  const [role, setRole] = useState<string>('Администратор')
  // профиль оплаты сотрудника берётся из стора (офис правит → касса видит то же)
  const okladOf = (id: string) => payProfiles[id]?.oklad ?? DEFAULT_OKLAD
  const rateOf = (id: string) => payProfiles[id]?.rate ?? DEFAULT_HOUR_RATE
  const modeOf = (id: string, positions: string[]) => payProfiles[id]?.mode ?? defaultPayMode(positions)
  const allowed = ROLE_SECTIONS[role]
  const visibleNav = NAV.filter((n) => allowed.includes(n.id))
  useEffect(() => { if (!allowed.includes(section)) setSection(allowed[0]) }, [role]) // роль сменилась → перейти на доступный раздел
  const [editDish, setEditDish] = useState('')
  // бухгалтерия (KZ)
  const [cName, setCName] = useState(''); const [cBin, setCBin] = useState('')
  const [supplierId, setSupplierId] = useState('')
  // тач-модалки (вместо window.prompt): приход на склад / удержание-штраф
  const [recvItem, setRecvItem] = useState<{ id: string; name: string; unit: string } | null>(null)
  const [deductStaff, setDeductStaff] = useState<{ id: string; name: string } | null>(null)
  const [pLines, setPLines] = useState<{ ingredientId: string; name: string; qty: number; price: number }[]>([])
  const [pIng, setPIng] = useState(ingredients[0]?.id ?? ''); const [pQty, setPQty] = useState(''); const [pPrice, setPPrice] = useState('')
  // шапка приходной накладной (№/дата/ЭСФ/склад-получатель)
  const [pStore, setPStore] = useState(warehouses[0]); const [pDate, setPDate] = useState(todayISO()); const [pNo, setPNo] = useState(''); const [pEsf, setPEsf] = useState('')
  const [outBuyer, setOutBuyer] = useState(''); const [outAmount, setOutAmount] = useState('')
  // карточка сотрудника (раздел staff)
  const [editStaff, setEditStaff] = useState<{ id: string | null; name: string; pin: string; positions: string[] } | null>(null)
  // приказы цен (раздел prikazy)
  const [poLines, setPoLines] = useState<PriceOrderLine[]>([])
  const [poDish, setPoDish] = useState(dishes[0]?.id ?? '')
  const [poPrice, setPoPrice] = useState('')
  const [poDate, setPoDate] = useState(todayISO())
  const [poNote, setPoNote] = useState('')
  const [poCal, setPoCal] = useState(false)
  const addPoLine = () => {
    const d = dishes.find((x) => x.id === poDish); const np = parseFloat(poPrice.replace(',', '.'))
    if (!d || !(np >= 0)) return
    setPoLines((ls) => [...ls.filter((l) => l.dishId !== d.id), { dishId: d.id, name: d.name, oldPrice: priceOf(d.id, d.price), newPrice: np }])
    setPoPrice('')
  }
  const submitPriceOrder = () => {
    const o = createPriceOrder(poLines, poDate, poNote.trim() || 'Изменение цен')
    if (o) { printToast(`Приказ ${o.no} создан (черновик)`); setPoLines([]); setPoNote('') }
  }
  // розничные продажи (раздел retail)
  const [newPt, setNewPt] = useState({ name: '', kind: 'cashless' as PaymentKind, code: '' })
  const [newCo, setNewCo] = useState({ name: '', direction: 'out' as 'in' | 'out', requireComment: false, limit: '' })
  const [newReason, setNewReason] = useState('')
  const [newOt, setNewOt] = useState({ name: '', mode: 'dinein' as OrderType, vat: 16 as VatRate })
  const [menuCat, setMenuCat] = useState('base') // редактируемая ценовая категория в «Меню и цены»
  const [newCat, setNewCat] = useState('')
  const [financeTab, setFinanceTab] = useState<'book' | 'cashflow' | 'ledger'>('book')
  const [rightSearch, setRightSearch] = useState('')
  const [rightScope, setRightScope] = useState<'all' | 'front' | 'office' | 'delivery'>('all')
  const [newSh, setNewSh] = useState({ name: '', from: '09:00', to: '18:00' })
  // дисконтная система (раздел discount)
  const [newDisc, setNewDisc] = useState({ name: '', kind: 'discount' as 'discount' | 'surcharge', percent: '', manual: true, byCard: false, minSum: '', fromTime: '', toTime: '' })
  const [newCard, setNewCard] = useState({ number: '', owner: '', discountId: '' })
  // мотивация (раздел payroll)
  const [newMotiv, setNewMotiv] = useState({ name: '', scope: 'all' as 'all' | 'dish' | 'group', targetId: '', mode: 'percent' as 'percent' | 'perUnit', value: '', minQty: '' })
  // отчёты (раздел reports)
  const [report, setReport] = useState<'sales' | 'avg' | 'unsold' | 'purchases' | 'stock' | 'vat' | 'olap' | 'pnl'>('sales')
  const [salesMode, setSalesMode] = useState<'byDish' | 'byDay'>('byDish')
  const [purchMode, setPurchMode] = useState<'bySupplier' | 'byStore'>('bySupplier') // Отчёт о закупках (topic-607): по поставщикам / по складам
  const [stockCrit, setStockCrit] = useState<'all' | 'belowMin' | 'zero' | 'neg'>('all')
  const [unsoldMax, setUnsoldMax] = useState('5') // порог «плохо раскупается» (topic-621): количество ≤ N
  const addPLine = () => {
    const ing = ingredients.find((i) => i.id === pIng); const q = parseFloat(pQty.replace(',', '.')); const pr = parseFloat(pPrice.replace(',', '.'))
    if (!ing || !(q > 0) || !(pr > 0)) return
    setPLines((ls) => [...ls.filter((l) => l.ingredientId !== ing.id), { ingredientId: ing.id, name: ing.name, qty: q, price: pr }]); setPQty(''); setPPrice('')
  }
  const provesti = () => {
    if (!supplierId || pLines.length === 0) return
    const inv = addPurchase(supplierId, pLines, { store: pStore, date: pDate, no: pNo, esfNo: pEsf })
    if (inv) { printToast(`Приходная ${inv.no} проведена · ЭСФ ${inv.esfNo} · склад ${inv.store ?? '—'}`); setPLines([]); setPNo(''); setPEsf('') }
  }

  // сводка для раздела «Отчёты»
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)
  // мультиставка ҚҚС: разбивка по реальным ставкам позиций (16%/0%), как в отчётах iiko (011/041)
  const vatRowsKz = vatBreakdown(closedOrders.flatMap((o) => o.lines).map((l) => ({ gross: lineTotal(l), rate: l.vat })))
  const vatKz = +vatRowsKz.reduce((s, r) => s + r.vat, 0).toFixed(2) // ҚҚС в т.ч. с продаж (все ставки)
  const netRevenue = +vatRowsKz.reduce((s, r) => s + r.net, 0).toFixed(2) // оборот без ҚҚС
  const multiRateKz = vatRowsKz.length > 1
  const incoming = invoices.filter((i) => i.kind !== 'out')
  const outgoing = invoices.filter((i) => i.kind === 'out')
  const exportTo1C = () => {
    const data = { сформирован: 'демо', выручка: revenue, ҚҚС_к_уплате: vatKz, чеков: closedOrders.length, входящих_ЭСФ: invoices.length, накладные: invoices }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'iiko-1c-export.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  const avg = closedOrders.length ? revenue / closedOrders.length : 0
  const refSum = refunds.reduce((s, r) => s + r.amount, 0)
  // Excel-экспорт текущего отчёта (как «Excel…» в iikoOffice)
  const exportExcel = () => {
    if (report === 'sales' && salesMode === 'byDish') {
      downloadExcel('iiko-продажи-по-блюдам', [
        ['Блюдо', 'Кол-во', 'Выручка', 'ҚҚС %', 'Без НДС', 'Себест.', 'Валовая', 'Наценка %'],
        ...salesByDish.map((d) => {
          const g = +(noVat(d.rev, d.vat) - d.cost).toFixed(2)
          return [d.name, xlsNum(d.qty), xlsNum(d.rev), d.vat, xlsNum(noVat(d.rev, d.vat)), xlsNum(d.cost), xlsNum(g), d.cost > 0 ? Math.round(g / d.cost * 100) : 0]
        }),
      ])
    } else if (report === 'sales') {
      downloadExcel('iiko-продажи-по-дням', [['Дата', 'Чеков', 'Выручка', 'Средний чек'],
        ...salesByDay.map((d) => [d.day, d.checks, xlsNum(d.rev), xlsNum(d.rev / d.checks)])])
    } else if (report === 'avg') {
      downloadExcel('iiko-средний-чек', [['Дата', 'Чеков', 'Гостей', 'Продажи', 'Средний чек', 'Средний заказ гостя', 'Ср. гостей на заказ'],
        ...avgByDay.map((d) => [d.day, d.checks, d.guests, xlsNum(d.sales), xlsNum(avgCheck(d.sales, d.checks)), xlsNum(avgGuestOrder(d.sales, d.guests)), xlsNum(avgGuestsPer(d.sales, d.checks, d.guests))]),
        ['Итого', avgTot.checks, avgTot.guests, xlsNum(avgTot.sales), xlsNum(avgCheck(avgTot.sales, avgTot.checks)), xlsNum(avgGuestOrder(avgTot.sales, avgTot.guests)), xlsNum(avgGuestsPer(avgTot.sales, avgTot.checks, avgTot.guests))]])
    } else if (report === 'unsold') {
      downloadExcel('iiko-непродаваемые-блюда', [['Название', 'Группа', 'Продано'],
        ...unsoldRows.map((x) => [x.d.name, x.group, xlsNum(x.qty, 2)])])
    } else if (report === 'purchases') {
      if (purchMode === 'bySupplier') {
        downloadExcel('iiko-закупки-по-поставщикам', [['Поставщик', 'Накладных', 'Сумма', 'в т.ч. ҚҚС', 'Доля %'],
          ...purchBySupplier.map((s) => [s.name, s.count, xlsNum(s.sum), xlsNum(s.vat), share(s.sum)]),
          ['Итого', purchBySupplier.reduce((a, s) => a + s.count, 0), xlsNum(purchTotal), xlsNum(purchBySupplier.reduce((a, s) => a + s.vat, 0)), 100]])
      } else {
        downloadExcel('iiko-закупки-по-складам', [['Склад', 'Накладных', 'Сумма', 'Доля %'],
          ...purchByStore.map((s) => [s.store, s.count, xlsNum(s.sum), share(s.sum)]),
          ['Итого', purchByStore.reduce((a, s) => a + s.count, 0), xlsNum(purchTotal), 100]])
      }
    } else if (report === 'stock') {
      downloadExcel('iiko-остатки', [['Артикул', 'Товар', 'Ед.', 'Остаток', 'Мин.', 'Себест/ед', 'Сумма'],
        ...stockRows.map((i) => [i.code, i.name, i.unit, xlsNum(i.stock, 3), i.min, xlsNum(i.costPerUnit), xlsNum(i.stock * i.costPerUnit)])])
    } else if (report === 'vat') {
      downloadExcel('iiko-ҚҚС-по-ставкам', [['Ставка ҚҚС', 'Оборот (с ҚҚС)', 'Без НДС', 'Сумма ҚҚС'],
        ...vatRowsKz.map((r) => [`${r.rate}%`, xlsNum(r.gross), xlsNum(r.net), xlsNum(r.vat)]),
        ['Итого', xlsNum(vatRowsKz.reduce((s, r) => s + r.gross, 0)), xlsNum(netRevenue), xlsNum(vatKz)]])
    }
  }

  // ───────── данные для отчётов (раздел reports) ─────────
  const noVat = (x: number, rate = 16) => +(x / (1 + rate / 100)).toFixed(2) // оборот без ҚҚС по ставке позиции
  const dayKey = (s: string) => s.split(',')[0] ?? s // fullNow() = "dd.mm.yyyy, hh:mm"
  const lineCost = (dishId: string, qty: number) => dishCost(dishId, ingredients, techCardOverrides) * qty

  // продажи по блюдам: выручка / себест. / валовая прибыль / наценка (ставка ҚҚС — у каждой позиции своя)
  const salesByDish = Object.values(closedOrders.reduce((acc, o) => {
    for (const l of o.lines) {
      const a = (acc[l.dishId] ??= { name: l.name, qty: 0, rev: 0, cost: 0, vat: l.vat })
      a.qty += l.qty; a.rev += lineTotal(l); a.cost += lineCost(l.dishId, l.qty)
    }
    return acc
  }, {} as Record<string, { name: string; qty: number; rev: number; cost: number; vat: number }>)).sort((a, b) => b.rev - a.rev)

  // продажи по дням
  const salesByDay = Object.values(closedOrders.reduce((acc, o) => {
    const k = dayKey(o.paidAt)
    const a = (acc[k] ??= { day: k, checks: 0, rev: 0 })
    a.checks++; a.rev += o.total
    return acc
  }, {} as Record<string, { day: string; checks: number; rev: number }>))

  // Отчёт о среднем чеке (topic-603): по учётным дням периода — чеки/гости/продажи + средние.
  // Чеки = закрытые заказы (в моке «за счёт заведения» нет); возвраты — отдельный возвратный чек, заказ остаётся.
  const avgByDay = Object.values(closedOrders.reduce((acc, o) => {
    const k = dayKey(o.paidAt)
    const a = (acc[k] ??= { day: k, checks: 0, guests: 0, sales: 0 })
    a.checks++; a.guests += o.guests; a.sales += o.total
    return acc
  }, {} as Record<string, { day: string; checks: number; guests: number; sales: number }>))
  const avgTot = avgByDay.reduce((t, d) => ({ checks: t.checks + d.checks, guests: t.guests + d.guests, sales: t.sales + d.sales }), { checks: 0, guests: 0, sales: 0 })
  // формулы 1:1: Средний чек = Продажи/Чеки · Средний заказ гостя = Продажи/Гости · Ср. гостей на заказ = Ср.чек/Ср.заказ (= Гости/Чеки)
  const avgCheck = (s: number, c: number) => (c ? s / c : 0)
  const avgGuestOrder = (s: number, g: number) => (g ? s / g : 0)
  const avgGuestsPer = (s: number, c: number, g: number) => { const ac = avgCheck(s, c), ag = avgGuestOrder(s, g); return ag ? ac / ag : 0 }

  // Непродаваемые блюда (topic-621): блюда «в продаже на период» с количеством продаж ≤ порога.
  // В моке все блюда меню считаются в продаже; «количество» = продано за период (closedOrders).
  const soldQtyByDish = closedOrders.reduce((acc, o) => { for (const l of o.lines) acc[l.dishId] = (acc[l.dishId] ?? 0) + l.qty; return acc }, {} as Record<string, number>)
  const unsoldThreshold = Math.max(0, parseInt(unsoldMax, 10) || 0)
  const unsoldRows = dishes
    .map((d) => ({ d, qty: +(soldQtyByDish[d.id] ?? 0).toFixed(2), group: menuGroups.find((g) => g.id === d.groupId)?.name ?? '—' }))
    .filter((x) => x.qty <= unsoldThreshold)
    .sort((a, b) => a.qty - b.qty || a.d.name.localeCompare(b.d.name))

  // Отчёт о закупках (topic-607): по приходным накладным (входящие ЭСФ). Виды — по поставщикам / по складам, с долей %.
  const purchTotal = +incoming.reduce((s, i) => s + i.total, 0).toFixed(2)
  const purchBySupplier = Object.values(incoming.reduce((acc, i) => {
    const a = (acc[i.supplierName] ??= { name: i.supplierName, count: 0, sum: 0, vat: 0 }); a.count++; a.sum += i.total; a.vat += i.vat; return acc
  }, {} as Record<string, { name: string; count: number; sum: number; vat: number }>)).sort((a, b) => b.sum - a.sum)
  const purchByStore = Object.values(incoming.reduce((acc, i) => {
    const k = i.store ?? '—'; const a = (acc[k] ??= { store: k, count: 0, sum: 0 }); a.count++; a.sum += i.total; return acc
  }, {} as Record<string, { store: string; count: number; sum: number }>)).sort((a, b) => b.sum - a.sum)
  const share = (s: number) => (purchTotal ? Math.round(s / purchTotal * 100) : 0)

  // остатки на складах + критерий
  const stockRows = ingredients.filter((i) =>
    stockCrit === 'belowMin' ? i.stock < i.min : stockCrit === 'zero' ? i.stock === 0 : stockCrit === 'neg' ? i.stock < 0 : true)
  const stockValue = ingredients.reduce((s, i) => s + i.stock * i.costPerUnit, 0)

  // P&L (упрощённо): выручка без НДС − себестоимость проданного − ФОТ (оклады + СО 3.5%)
  const cogs = +closedOrders.reduce((s, o) => s + o.lines.reduce((x, l) => x + lineCost(l.dishId, l.qty), 0), 0).toFixed(2)
  const payrollBase = staffList.reduce((s, p) => s + okladOf(p.id), 0) // оклады (gross)
  const payrollEmployer = staffList.reduce((s, p) => s + kzTax(okladOf(p.id)).employerCost, 0) // полная стоимость ФОТ с взносами РК
  const grossProfit = +(netRevenue - cogs).toFixed(2)
  const opProfit = +(grossProfit - payrollEmployer).toFixed(2)

  // премия по мотивационным программам — за личные продажи сотрудника (waiter) в закрытых заказах
  const motivationOf = (staffName: string) => {
    let bonus = 0
    for (const prog of motivationPrograms.filter((m) => m.active)) {
      let qty = 0, rev = 0
      for (const o of closedOrders) {
        if (o.waiter !== staffName) continue
        for (const l of o.lines) {
          const d = findDish(l.dishId)
          const match = prog.scope === 'all' || (prog.scope === 'dish' && l.dishId === prog.targetId) || (prog.scope === 'group' && d?.groupId === prog.targetId)
          if (match) { qty += l.qty; rev += lineTotal(l) }
        }
      }
      if (prog.minQty && qty < prog.minQty) continue
      bonus += prog.mode === 'percent' ? rev * prog.value / 100 : qty * prog.value
    }
    return Math.round(bonus)
  }

  // отработанные часы из ЯВОК кассы (тот же справочник, что и AttendanceScreen): in→out, открытая смена → до now
  const toMin = (t?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec((t ?? '').trim()); return m ? +m[1] * 60 + +m[2] : null }
  const nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })()
  const hoursOf = (staffName: string) => {
    let mins = 0
    for (const a of attendance) {
      if (a.staff !== staffName || a.type !== 'Отработано') continue
      const i = toMin(a.in); if (i == null) continue
      mins += Math.max(0, (toMin(a.out) ?? nowMin) - i)
    }
    return +(mins / 60).toFixed(1)
  }
  // ───────── зарплата: начислено (база − налоги + премия − удержания) + выплаты (аванс/расчёт) ─────────
  // База = оклад ИЛИ повременная (часы из явок кассы × ставка). Премия — за продажи в закрытых заказах кассы.
  const payrollOf = (staffId: string, staffName: string, positions: string[]) => {
    const mode = modeOf(staffId, positions)
    const hours = hoursOf(staffName)
    const rate = rateOf(staffId)
    const okl = mode === 'hourly' ? Math.round(hours * rate) : okladOf(staffId)
    const t = kzTax(okl) // 🇰🇿 налоги РК 2026
    const premium = motivationOf(staffName)
    const deduction = salaryDeductions.filter((d) => d.staffId === staffId).reduce((s, d) => s + d.amount, 0)
    const net = +(t.net + premium - deduction).toFixed(2) // итого к выплате на руки
    const advance = salaryPayouts.filter((p) => p.staffId === staffId && p.kind === 'advance').reduce((s, p) => s + p.amount, 0)
    const settle = salaryPayouts.filter((p) => p.staffId === staffId && p.kind === 'settlement').reduce((s, p) => s + p.amount, 0)
    const remaining = +(net - advance - settle).toFixed(2)
    return { okl, mode, hours, rate, ...t, premium, deduction, net, advance, settle, remaining }
  }
  // сводка по зарплате (для шапки раздела)
  const payrollRows = staffList.map((p) => ({ p, ...payrollOf(p.id, p.name, p.positions) }))
  const totNet = payrollRows.reduce((s, r) => s + r.net, 0)
  const totPremium = payrollRows.reduce((s, r) => s + r.premium, 0)
  const totAdvance = payrollRows.reduce((s, r) => s + r.advance, 0)
  const totSettle = payrollRows.reduce((s, r) => s + r.settle, 0)
  const totRemaining = payrollRows.reduce((s, r) => s + r.remaining, 0)

  const Toggle = ({ k, label, note }: { k: keyof Establishment; label: string; note: string }) => (
    <button onClick={() => setEstablishment({ [k]: !est[k] } as Partial<Establishment>)}
      className="flex items-center justify-between h-16 px-4 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-left">
      <div>
        <div className="text-gray-800">{label}</div>
        <div className="text-xs text-gray-400">{note}</div>
      </div>
      <div className={`w-12 h-7 rounded-full flex items-center px-0.5 transition ${est[k] ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'}`}>
        <div className="w-6 h-6 rounded-full bg-white shadow" />
      </div>
    </button>
  )

  return (
    <div className="h-full flex bg-gray-100 text-gray-800">
      {/* сайдбар */}
      <div className="w-60 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 font-semibold border-b border-white/10">iikoOffice <span className="text-white/40 text-xs ml-2">мок</span></div>
        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-white/40 text-[11px] mb-1">Роль (вход в офис)</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-9 rounded bg-white/10 text-white px-2 text-sm">
            {OFFICE_ROLES.map((r) => <option key={r} value={r} className="text-gray-800">{r}</option>)}
          </select>
        </div>
        <nav className="flex-1 py-2 overflow-auto">
          {visibleNav.map((n) => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`w-full text-left px-5 h-11 flex items-center text-sm ${n.id === section ? 'bg-white/10 border-l-2 border-emerald-400 font-medium' : 'text-white/70 hover:bg-white/5'}`}>
              {n.label}
            </button>
          ))}
        </nav>
        <button onClick={() => navigate('/')}
          className="m-4 h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2">
          <Monitor size={18} /> Открыть кассу (Front)
        </button>
      </div>

      {/* контент */}
      <div className="flex-1 overflow-auto">
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <div className="font-semibold">{SECTION_TITLE[section]}</div>
          <div className="ml-auto text-xs text-gray-400">конфиг уезжает на кассу · сохраняется в localStorage</div>
        </div>

        {section === 'corp' ? (
          <OfficeCorp />
        ) : section === 'settings' ? (
          <div className="p-6 max-w-3xl">
            <div className="text-xs text-gray-500 mb-5">
              Профиль заведения (как в реальном iikoOffice). Касса (Front) только читает его и применяет.
              Изменения вступают в силу сразу при переходе на кассу.
            </div>

            <div className="mb-6">
              <div className="text-gray-500 text-xs uppercase mb-2">Тип заведения (режим обслуживания)</div>
              <div className="grid grid-cols-2 gap-3">
                {([['restaurant', 'Ресторан', 'столы, гости, деление, пречек'], ['fastfood', 'Фастфуд', 'быстрый чек, без столов и пречека']] as const).map(([m, label, note]) => (
                  <button key={m} onClick={() => setEstablishment({ mode: m, name: m === 'restaurant' ? 'Ресторан (KZ)' : 'Фастфуд (KZ)' })}
                    className={`h-20 rounded-md flex flex-col items-center justify-center border ${est.mode === m ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-700 border-gray-200'}`}>
                    <span className="text-lg font-semibold flex items-center gap-2">{est.mode === m && <Check size={18} />}{label}</span>
                    <span className="text-xs opacity-70">{note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-gray-500 text-xs uppercase mb-2">Функции</div>
              <div className="grid grid-cols-2 gap-2">
                {FLAGS.map((f) => <Toggle key={f.key} k={f.key} label={f.label} note={f.note} />)}
              </div>
            </div>

            <div className="mb-2">
              <div className="text-gray-500 text-xs uppercase mb-2">Фискальные регистраторы</div>
              <div className="flex gap-3">
                {([1, 2] as const).map((n) => (
                  <button key={n} onClick={() => setEstablishment({ frCount: n })}
                    className={`h-12 px-8 rounded-md border ${est.frCount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>{n} ФР</button>
                ))}
              </div>
            </div>
          </div>
        ) : section === 'menu' ? (
          <div className="p-6 max-w-3xl">
            <div className="text-xs text-gray-500 mb-5">
              Цены меню. Изменённая цена сразу применяется на кассе (для новых позиций в заказе). Услуги без цены тоже здесь.
            </div>

            {/* ценовые категории (прайс-листы по категории гостя/карты) */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-gray-500 text-xs uppercase">Ценовая категория:</span>
              {priceCategories.map((c) => (
                <span key={c.id} className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-sm cursor-pointer ${menuCat === c.id ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                  onClick={() => setMenuCat(c.id)}>
                  {c.name}
                  {c.id !== 'base' && <button onClick={(e) => { e.stopPropagation(); if (menuCat === c.id) setMenuCat('base'); removePriceCategory(c.id) }} className="opacity-60 hover:opacity-100">✕</button>}
                </span>
              ))}
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="новая категория" className="h-8 w-40 rounded border border-gray-300 px-2 text-sm" />
              <button onClick={() => { if (newCat.trim()) { addPriceCategory(newCat.trim()); setNewCat('') } }} className="h-8 px-3 rounded bg-gray-200 text-gray-700 text-sm">+ категория</button>
              {menuCat !== 'base' && <span className="text-xs text-gray-400">Цены ниже — для «{priceCategories.find((c) => c.id === menuCat)?.name}»; пусто = базовая цена.</span>}
            </div>

            {menuGroups.map((g) => {
              const items = dishesByGroup(g.id)
              if (!items.length) return null
              return (
                <div key={g.id} className="mb-6">
                  <div className="text-gray-500 text-xs uppercase mb-2">{g.name}</div>
                  <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                    {items.map((d) => {
                      const baseEff = priceOverrides[d.id] ?? d.price
                      const isBase = menuCat === 'base'
                      const catVal = categoryPrices[menuCat]?.[d.id]
                      const value = isBase ? baseEff : (catVal ?? '')
                      const overridden = isBase ? baseEff !== d.price : catVal != null
                      return (
                        <div key={d.id} className="flex items-center gap-3 px-4 h-14 border-b border-gray-100 last:border-0">
                          <span className="font-mono text-xs text-gray-400 w-12">{d.code}</span>
                          <span className="flex-1">{d.name}</span>
                          {!isBase && <span className="text-xs text-gray-400">базовая {formatTenge(baseEff)}</span>}
                          {isBase && overridden && <span className="text-xs text-gray-400 line-through">{formatTenge(d.price)}</span>}
                          <div className="flex items-center gap-1">
                            <input type="number" value={value} min={0} placeholder={isBase ? undefined : String(baseEff)}
                              onChange={(e) => { const v = Math.max(0, parseFloat(e.target.value) || 0); isBase ? setDishPrice(d.id, v) : setCategoryPrice(menuCat, d.id, v) }}
                              className="w-28 h-9 rounded border border-gray-300 px-2 text-right" />
                            <span className="text-gray-400 text-sm">₸</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : section === 'prikazy' ? (
          <div className="p-6 max-w-4xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="text-xs text-gray-500 flex-1">
                Приказ об изменении цен (как в iikoOffice): набор новых цен + дата вступления в силу. <b>Активация</b> отправляет цены на кассу.
                Приказы с наступившей датой вступления <b>применяются автоматически</b> при запуске; будущие — ждут своей даты.
              </div>
              <button onClick={() => { const n = applyDuePriceOrders(); printToast(n > 0 ? `Применено приказов по дате: ${n}` : 'Приказов к применению нет') }}
                className="h-9 px-3 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 shrink-0">Применить по дате</button>
            </div>

            {/* конструктор приказа */}
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-6">
              <div className="text-gray-500 text-xs uppercase mb-2">Новый приказ</div>
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <label className="flex flex-col text-xs text-gray-500">Блюдо
                  <select value={poDish} onChange={(e) => setPoDish(e.target.value)} className="mt-1 h-9 rounded border border-gray-300 px-2 min-w-[220px]">
                    {dishes.map((d) => <option key={d.id} value={d.id}>{d.name} · тек. {priceOf(d.id, d.price)} ₸</option>)}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-gray-500">Новая цена ₸
                  <input value={poPrice} onChange={(e) => setPoPrice(e.target.value)} inputMode="decimal" placeholder="0" className="mt-1 h-9 w-28 rounded border border-gray-300 px-2 text-right" />
                </label>
                <button onClick={addPoLine} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">+ строка</button>
                <label className="flex flex-col text-xs text-gray-500 ml-auto">Дата вступления
                  <button onClick={() => setPoCal(true)} className="mt-1 h-9 px-3 rounded border border-gray-300 text-gray-800">{formatRu(poDate)}</button>
                </label>
              </div>
              <input value={poNote} onChange={(e) => setPoNote(e.target.value)} placeholder="Примечание к приказу (необязательно)" className="h-9 w-full rounded border border-gray-300 px-2 mb-3 text-sm" />
              {poLines.length > 0 && (
                <div className="border border-gray-100 rounded mb-3">
                  {poLines.map((l) => (
                    <div key={l.dishId} className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
                      <span className="flex-1">{l.name}</span>
                      <span className="text-gray-400 line-through">{formatTenge(l.oldPrice)}</span>
                      <span className="w-24 text-right font-medium">{formatTenge(l.newPrice)}</span>
                      <button onClick={() => setPoLines((ls) => ls.filter((x) => x.dishId !== l.dishId))} className="text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={submitPriceOrder} disabled={poLines.length === 0}
                className={`h-9 px-4 rounded text-sm ${poLines.length ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Создать приказ (черновик)</button>
            </div>

            {/* список приказов */}
            <div className="text-gray-500 text-xs uppercase mb-2">Приказы</div>
            <div className="space-y-3">
              {priceOrders.length === 0 ? <div className="text-gray-400 text-sm">Приказов пока нет.</div> : priceOrders.map((o) => (
                <div key={o.id} className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  <div className="flex items-center gap-3 px-4 h-11 border-b border-gray-100">
                    <span className="font-medium">{o.no}</span>
                    <span className="text-sm text-gray-500">с {formatRu(o.date)} · {o.note}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{o.status === 'active' ? 'действует' : 'черновик'}</span>
                    {o.status === 'draft'
                      ? <span className="ml-auto flex items-center gap-2">
                          {o.date > todayISO() && <span className="text-xs text-gray-400">авто с {formatRu(o.date)}</span>}
                          <button onClick={() => { activatePriceOrder(o.id); printToast(`Приказ ${o.no} активирован — цены на кассе обновлены`) }} className="h-8 px-3 rounded bg-blue-600 text-white text-xs">Активировать сейчас</button>
                        </span>
                      : <span className="ml-auto text-emerald-600 text-xs inline-flex items-center gap-1"><Check size={13} />цены на кассе</span>}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {o.lines.map((l) => (
                        <tr key={l.dishId} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-1.5">{l.name}</td>
                          <td className="py-1.5 text-right text-gray-400 line-through">{formatTenge(l.oldPrice)}</td>
                          <td className="px-4 py-1.5 text-right w-28 font-medium">{formatTenge(l.newPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {poCal && <CalendarModal value={fromISO(poDate)} onOk={(d) => { setPoDate(toISO(d)); setPoCal(false) }} onCancel={() => setPoCal(false)} />}
          </div>
        ) : section === 'retail' ? (
          <div className="p-6 max-w-4xl">
            <div className="text-xs text-gray-500 mb-5">
              Справочники кассовых операций (Розничные продажи, iikoOffice). Касса (Front) читает их сразу:
              типы оплат → экран оплаты, типы внесений/изъятий → «Внести/Изъять деньги», причины списания → «Документы».
            </div>

            {/* Типы оплат */}
            <div className="text-gray-500 text-xs uppercase mb-2">Типы оплат (вкладки на экране оплаты)</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2">Активен</th><th>Название</th><th>Вид</th><th>Код</th>
                  <th className="text-center">Ящик</th><th className="text-center">Точная сумма</th><th className="text-center">Тов. чек</th><th className="text-center">Комбинир.</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {paymentTypes.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2"><input type="checkbox" checked={!!p.active} onChange={(e) => updatePaymentType(p.id, { active: e.target.checked })} /></td>
                      <td>{p.name}</td>
                      <td className="text-gray-500 text-xs">{p.kind}</td>
                      <td className="font-mono text-xs text-gray-400">{p.code ?? '—'}</td>
                      <td className="text-center"><input type="checkbox" checked={!!p.openDrawer} onChange={(e) => updatePaymentType(p.id, { openDrawer: e.target.checked })} /></td>
                      <td className="text-center"><input type="checkbox" checked={!!p.exactSum} onChange={(e) => updatePaymentType(p.id, { exactSum: e.target.checked })} /></td>
                      <td className="text-center"><input type="checkbox" checked={!!p.printReceipt} onChange={(e) => updatePaymentType(p.id, { printReceipt: e.target.checked })} /></td>
                      <td className="text-center"><input type="checkbox" checked={!!p.combinable} onChange={(e) => updatePaymentType(p.id, { combinable: e.target.checked })} /></td>
                      <td className="p-2 text-right">{p.id.startsWith('p-custom') || !['p-cash', 'p-card', 'p-cashless', 'p-norev', 'p-bonus'].includes(p.id)
                        ? <button onClick={() => removePaymentType(p.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                        : <span className="text-gray-300 text-xs">системный</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-end gap-2 mb-6">
              <input value={newPt.name} onChange={(e) => setNewPt({ ...newPt, name: e.target.value })} placeholder="Название (напр. Сертификат)" className="h-9 rounded border border-gray-300 px-2 flex-1" />
              <select value={newPt.kind} onChange={(e) => setNewPt({ ...newPt, kind: e.target.value as PaymentKind })} className="h-9 rounded border border-gray-300 px-2">
                <option value="cashless">Безналичный</option><option value="noRevenue">Без выручки</option><option value="bonus">Бонусы</option><option value="card">Карта</option>
              </select>
              <input value={newPt.code} onChange={(e) => setNewPt({ ...newPt, code: e.target.value.toUpperCase() })} placeholder="КОД" className="h-9 w-28 rounded border border-gray-300 px-2 font-mono" />
              <button onClick={() => { if (newPt.name.trim()) { addPaymentType({ name: newPt.name.trim(), kind: newPt.kind, code: newPt.code, active: true, combinable: true }); setNewPt({ name: '', kind: 'cashless', code: '' }) } }}
                className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить тип</button>
            </div>

            {/* Типы внесений / изъятий */}
            <div className="text-gray-500 text-xs uppercase mb-2">Типы внесений / изъятий наличных</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Направление</th><th>Название</th><th className="text-center">Коммент. обязателен</th><th className="text-right">Лимит</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {cashOpTypes.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${c.direction === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{c.direction === 'in' ? 'внесение' : 'изъятие'}</span></td>
                      <td>{c.name}</td>
                      <td className="text-center">{c.requireComment ? '✓' : '—'}</td>
                      <td className="text-right text-gray-500">{c.limit ? formatTenge(c.limit) : '—'}</td>
                      <td className="p-2 text-right"><button onClick={() => removeCashOpType(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-end gap-2 mb-6">
              <select value={newCo.direction} onChange={(e) => setNewCo({ ...newCo, direction: e.target.value as 'in' | 'out' })} className="h-9 rounded border border-gray-300 px-2">
                <option value="in">Внесение</option><option value="out">Изъятие</option>
              </select>
              <input value={newCo.name} onChange={(e) => setNewCo({ ...newCo, name: e.target.value })} placeholder="Название операции" className="h-9 rounded border border-gray-300 px-2 flex-1" />
              <input value={newCo.limit} onChange={(e) => setNewCo({ ...newCo, limit: e.target.value.replace(/\D/g, '') })} placeholder="лимит ₸" className="h-9 w-28 rounded border border-gray-300 px-2 text-right" />
              <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={newCo.requireComment} onChange={(e) => setNewCo({ ...newCo, requireComment: e.target.checked })} />коммент.</label>
              <button onClick={() => { if (newCo.name.trim()) { addCashOpType({ name: newCo.name.trim(), direction: newCo.direction, requireComment: newCo.requireComment, limit: newCo.limit ? Number(newCo.limit) : undefined, manual: true }); setNewCo({ name: '', direction: 'out', requireComment: false, limit: '' }) } }}
                className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить</button>
            </div>

            {/* Причины списания */}
            <div className="text-gray-500 text-xs uppercase mb-2">Причины списания (акт списания на кассе)</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {writeoffReasons.map((r) => (
                <span key={r} className="inline-flex items-center gap-2 h-9 px-3 rounded bg-white border border-gray-200 text-sm">
                  {r}<button onClick={() => removeWriteoffReason(r)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                </span>
              ))}
              {writeoffReasons.length === 0 && <span className="text-gray-400 text-sm">Причин нет.</span>}
            </div>
            <div className="flex items-end gap-2">
              <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Новая причина" className="h-9 rounded border border-gray-300 px-2 w-64" />
              <button onClick={() => { if (newReason.trim()) { addWriteoffReason(newReason); setNewReason('') } }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm inline-flex items-center gap-1"><Plus size={14} />Добавить</button>
            </div>

            {/* Типы заказов (topic-112): режим обслуживания + налоговая категория + по умолчанию */}
            <div className="text-gray-500 text-xs uppercase mb-2 mt-8">Типы заказов (режим обслуживания + налоговая категория)</div>
            <div className="text-xs text-gray-400 mb-2">Аналитический признак заказа + ставка ҚҚС по типу обслуживания. «По умолчанию» — тип новых заказов на кассе.</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2">По умолч.</th><th>Название</th><th>Режим</th><th className="text-center">ҚҚС</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {orderTypes.map((o) => (
                    <tr key={o.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2"><input type="radio" name="ot-default" checked={!!o.isDefault} onChange={() => setDefaultOrderType(o.id)} /></td>
                      <td><input value={o.name} onChange={(e) => updateOrderType(o.id, { name: e.target.value })} className="h-8 rounded border border-gray-200 px-2 w-56" /></td>
                      <td className="text-gray-500 text-xs">{o.mode === 'dinein' ? 'в зале' : o.mode === 'takeaway' ? 'на вынос' : 'доставка'}</td>
                      <td className="text-center">
                        <select value={o.vat} onChange={(e) => updateOrderType(o.id, { vat: Number(e.target.value) as VatRate })} className="h-8 rounded border border-gray-200 px-1">
                          <option value={16}>16%</option><option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="p-2 text-right">{o.isDefault ? <span className="text-gray-300 text-xs">по умолч.</span>
                        : <button onClick={() => removeOrderType(o.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-end gap-2">
              <input value={newOt.name} onChange={(e) => setNewOt({ ...newOt, name: e.target.value })} placeholder="Название (напр. Самовывоз)" className="h-9 rounded border border-gray-300 px-2 flex-1" />
              <select value={newOt.mode} onChange={(e) => setNewOt({ ...newOt, mode: e.target.value as OrderType })} className="h-9 rounded border border-gray-300 px-2">
                <option value="dinein">В зале</option><option value="takeaway">На вынос</option><option value="delivery">Доставка</option>
              </select>
              <select value={newOt.vat} onChange={(e) => setNewOt({ ...newOt, vat: Number(e.target.value) as VatRate })} className="h-9 rounded border border-gray-300 px-2">
                <option value={16}>ҚҚС 16%</option><option value={0}>ҚҚС 0%</option>
              </select>
              <button onClick={() => { if (newOt.name.trim()) { addOrderType({ name: newOt.name.trim(), mode: newOt.mode, vat: newOt.vat }); setNewOt({ name: '', mode: 'dinein', vat: 16 }) } }}
                className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить тип</button>
            </div>
          </div>
        ) : section === 'discount' ? (
          <div className="p-6 max-w-4xl">
            <div className="text-xs text-gray-500 mb-5">
              Скидки/надбавки и клубные карты (Дисконтная система, iikoOffice). Касса применяет на экране заказа:
              ручные — по праву F_ID, по карте — прокаткой номера. «Счастливый час» и «сумма не менее» проверяются автоматически.
            </div>

            {/* Скидки и надбавки */}
            <div className="text-gray-500 text-xs uppercase mb-2">Скидки и надбавки</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2">Название</th><th>Вид</th><th className="text-right">%</th><th className="text-center">Вручную</th><th className="text-center">По карте</th><th>Период</th><th className="text-right">От суммы</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {discounts.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2">{d.name}</td>
                      <td><span className={`text-xs px-2 py-0.5 rounded-full ${d.kind === 'discount' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{d.kind === 'discount' ? 'скидка' : 'надбавка'}</span></td>
                      <td className="text-right font-medium">{d.percent}%</td>
                      <td className="text-center"><input type="checkbox" checked={d.manual} onChange={(e) => updateDiscount(d.id, { manual: e.target.checked })} /></td>
                      <td className="text-center"><input type="checkbox" checked={d.byCard} onChange={(e) => updateDiscount(d.id, { byCard: e.target.checked })} /></td>
                      <td className="text-gray-500 text-xs">{d.fromTime ? `${d.fromTime}–${d.toTime}` : '—'}</td>
                      <td className="text-right text-gray-500">{d.minSum ? formatTenge(d.minSum) : '—'}</td>
                      <td className="p-2 text-right"><button onClick={() => removeDiscount(d.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end gap-2 mb-6 bg-white border border-gray-200 rounded p-3">
              <input value={newDisc.name} onChange={(e) => setNewDisc({ ...newDisc, name: e.target.value })} placeholder="Название" className="h-9 rounded border border-gray-300 px-2 flex-1 min-w-[160px]" />
              <select value={newDisc.kind} onChange={(e) => setNewDisc({ ...newDisc, kind: e.target.value as 'discount' | 'surcharge' })} className="h-9 rounded border border-gray-300 px-2">
                <option value="discount">Скидка</option><option value="surcharge">Надбавка</option>
              </select>
              <input value={newDisc.percent} onChange={(e) => setNewDisc({ ...newDisc, percent: e.target.value.replace(/[^\d.]/g, '') })} placeholder="%" className="h-9 w-16 rounded border border-gray-300 px-2 text-right" />
              <input value={newDisc.minSum} onChange={(e) => setNewDisc({ ...newDisc, minSum: e.target.value.replace(/\D/g, '') })} placeholder="от суммы" className="h-9 w-24 rounded border border-gray-300 px-2 text-right" />
              <input value={newDisc.fromTime} onChange={(e) => setNewDisc({ ...newDisc, fromTime: e.target.value })} placeholder="с ЧЧ:ММ" className="h-9 w-20 rounded border border-gray-300 px-2" />
              <input value={newDisc.toTime} onChange={(e) => setNewDisc({ ...newDisc, toTime: e.target.value })} placeholder="по ЧЧ:ММ" className="h-9 w-20 rounded border border-gray-300 px-2" />
              <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={newDisc.manual} onChange={(e) => setNewDisc({ ...newDisc, manual: e.target.checked })} />вручную</label>
              <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={newDisc.byCard} onChange={(e) => setNewDisc({ ...newDisc, byCard: e.target.checked })} />по карте</label>
              <button onClick={() => {
                const pct = parseFloat(newDisc.percent) || 0
                if (!newDisc.name.trim() || pct <= 0) return
                addDiscount({ name: newDisc.name.trim(), kind: newDisc.kind, percent: pct, manual: newDisc.manual, byCard: newDisc.byCard, auto: false, minSum: newDisc.minSum ? Number(newDisc.minSum) : undefined, fromTime: newDisc.fromTime || undefined, toTime: newDisc.toTime || undefined })
                setNewDisc({ name: '', kind: 'discount', percent: '', manual: true, byCard: false, minSum: '', fromTime: '', toTime: '' })
              }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить</button>
            </div>

            {/* Клубные карты */}
            <div className="text-gray-500 text-xs uppercase mb-2">Клубные карты</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Номер</th><th>Владелец</th><th>Скидка</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {clubCards.length === 0 ? <tr><td colSpan={4} className="p-3 text-gray-400">Карт нет.</td></tr> : clubCards.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2 font-mono">{c.number}</td>
                      <td>{c.owner}</td>
                      <td className="text-gray-600">{discounts.find((d) => d.id === c.discountId)?.name ?? '—'}</td>
                      <td className="p-2 text-right"><button onClick={() => removeClubCard(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-end gap-2">
              <input value={newCard.number} onChange={(e) => setNewCard({ ...newCard, number: e.target.value })} placeholder="Номер карты" className="h-9 rounded border border-gray-300 px-2 w-40" />
              <input value={newCard.owner} onChange={(e) => setNewCard({ ...newCard, owner: e.target.value })} placeholder="Владелец" className="h-9 rounded border border-gray-300 px-2 flex-1" />
              <select value={newCard.discountId} onChange={(e) => setNewCard({ ...newCard, discountId: e.target.value })} className="h-9 rounded border border-gray-300 px-2">
                <option value="">— скидка (по карте) —</option>
                {discounts.filter((d) => d.byCard).map((d) => <option key={d.id} value={d.id}>{d.name} {d.percent}%</option>)}
              </select>
              <button onClick={() => { if (newCard.number.trim() && newCard.discountId) { addClubCard({ number: newCard.number.trim(), owner: newCard.owner.trim(), discountId: newCard.discountId }); setNewCard({ number: '', owner: '', discountId: '' }) } }}
                className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Выпустить карту</button>
            </div>
          </div>
        ) : section === 'loyalty' ? (
          <OfficeLoyalty />
        ) : section === 'staff' ? (
          <div className="p-6 max-w-4xl">
            <div className="text-xs text-gray-500 mb-5">
              Роли и права (как в iikoOffice). Галочки задают, что разрешено должности; касса применяет сразу
              (стоп-лист, возврат, смена, деньги, скидки, отчёты, явки и т.д.).
            </div>

            <div className="flex items-center mb-2">
              <div className="text-gray-500 text-xs uppercase">Сотрудники (карточки → вход на кассе по PIN)</div>
              <button onClick={() => setEditStaff({ id: null, name: '', pin: '', positions: [POSITIONS[0]] })}
                className="ml-auto h-8 px-3 rounded bg-emerald-500 text-white text-xs inline-flex items-center gap-1"><Plus size={14} />Новый сотрудник</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-4">
              {staffList.length === 0 ? <div className="p-3 text-gray-400 text-sm">Сотрудников нет.</div> : staffList.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 h-12 border-b border-gray-100 last:border-0">
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-gray-400">PIN {s.pin}</span>
                  <span className="text-sm text-gray-600">{s.positions.join(', ')}</span>
                  <button onClick={() => setEditStaff({ id: s.id, name: s.name, pin: s.pin, positions: [...s.positions] })} className="text-blue-600 text-xs hover:underline">Изменить</button>
                  <button onClick={() => { if (confirm(`Удалить сотрудника «${s.name}»?`)) removeStaff(s.id) }} className="text-gray-400 hover:text-red-500" title="Удалить"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            {/* карточка создания/редактирования сотрудника */}
            {editStaff && (
              <div className="bg-white border border-emerald-300 rounded-md p-4 mb-6">
                <div className="font-medium mb-3">{editStaff.id ? 'Карточка сотрудника' : 'Новый сотрудник'}</div>
                <div className="flex flex-wrap gap-3 items-end mb-3">
                  <label className="flex flex-col text-xs text-gray-500">ФИО
                    <input value={editStaff.name} onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })} className="mt-1 h-9 w-64 rounded border border-gray-300 px-2 text-gray-800" placeholder="Фамилия И.О." />
                  </label>
                  <label className="flex flex-col text-xs text-gray-500">PIN (4 цифры)
                    <input value={editStaff.pin} onChange={(e) => setEditStaff({ ...editStaff, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" className="mt-1 h-9 w-28 rounded border border-gray-300 px-2 text-gray-800" placeholder="0000" />
                  </label>
                </div>
                <div className="text-xs text-gray-500 mb-1">Должности (право входа + права на кассе)</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {POSITIONS.map((p) => {
                    const on = editStaff.positions.includes(p)
                    return (
                      <button key={p} onClick={() => setEditStaff({ ...editStaff, positions: on ? editStaff.positions.filter((x) => x !== p) : [...editStaff.positions, p] })}
                        className={`h-8 px-3 rounded text-sm border ${on ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-300'}`}>{p}</button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const name = editStaff.name.trim()
                    if (!name || editStaff.pin.length !== 4 || editStaff.positions.length === 0) { alert('Заполните ФИО, 4-значный PIN и хотя бы одну должность'); return }
                    if (staffList.some((s) => s.pin === editStaff.pin && s.id !== editStaff.id)) { alert('PIN уже занят другим сотрудником'); return }
                    if (editStaff.id) updateStaff(editStaff.id, { name, pin: editStaff.pin, positions: editStaff.positions })
                    else addStaff({ name, pin: editStaff.pin, positions: editStaff.positions })
                    printToast(`Сотрудник «${name}» сохранён`); setEditStaff(null)
                  }} className="h-9 px-5 rounded bg-emerald-500 text-white text-sm">Сохранить</button>
                  <button onClick={() => setEditStaff(null)} className="h-9 px-5 rounded bg-gray-200 text-gray-700 text-sm">Отмена</button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="text-gray-500 text-xs uppercase">Права по должностям ({Object.keys(RIGHTS).length} прав · {POSITIONS.length} ролей)</div>
              <input value={rightSearch} onChange={(e) => setRightSearch(e.target.value)} placeholder="поиск права / кода" className="ml-auto h-8 w-56 rounded border border-gray-300 px-2 text-sm" />
              <div className="flex gap-1 bg-gray-100 rounded p-0.5">
                {([['all', 'Все'], ['front', 'Касса'], ['office', 'Офис'], ['delivery', 'Доставка']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setRightScope(k)} className={`h-7 px-2.5 rounded text-xs ${rightScope === k ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto" style={{ maxHeight: '70vh' }}>
              <table className="text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-gray-500 text-left border-b border-gray-200">
                    <th className="p-2 font-medium sticky left-0 bg-white min-w-[320px]">Право</th>
                    {POSITIONS.map((p) => <th key={p} className="p-2 font-medium text-center min-w-[84px]"><div className="-rotate-0 text-xs whitespace-nowrap">{p}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {RIGHT_GROUPS.filter((g) => rightScope === 'all' || g.scope === rightScope).map((g) => {
                    const q = rightSearch.trim().toLowerCase()
                    const rows = g.rights.filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
                    if (rows.length === 0) return null
                    return (
                      <Fragment key={g.title}>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td className="px-2 py-1.5 font-medium text-gray-700 text-xs uppercase sticky left-0 bg-gray-50">{g.title}</td>
                          {POSITIONS.map((p) => {
                            const codes = g.rights.map((r) => r.code)
                            const all = codes.every((c) => (roleRights[p] ?? []).includes(c))
                            return (
                              <td key={p} className="px-2 py-1 text-center">
                                <button onClick={() => codes.forEach((c) => { if ((roleRights[p] ?? []).includes(c) === all) toggleRoleRight(p, c) })}
                                  title={all ? 'снять группу' : 'выдать группу'} className="text-[10px] text-gray-400 hover:text-emerald-600">{all ? '✓все' : 'все'}</button>
                              </td>
                            )
                          })}
                        </tr>
                        {rows.map((r) => (
                          <tr key={r.code} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="p-2 sticky left-0 bg-white"><span className="font-mono text-xs text-gray-400 mr-2">{r.code}</span>{r.name}</td>
                            {POSITIONS.map((p) => (
                              <td key={p} className="p-2 text-center">
                                <input type="checkbox" checked={(roleRights[p] ?? []).includes(r.code)} onChange={() => toggleRoleRight(p, r.code)} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Phase 5: типы смен (расписание) */}
            <div className="text-gray-500 text-xs uppercase mb-2 mt-8">Типы смен (расписание)</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {shiftTypes.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-2 h-9 px-3 rounded bg-white border border-gray-200 text-sm">
                  {s.name} <span className="text-gray-400">{s.from}–{s.to}</span>
                  <button onClick={() => removeShiftType(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                </span>
              ))}
              {shiftTypes.length === 0 && <span className="text-gray-400 text-sm">Типов смен нет.</span>}
            </div>
            <div className="flex items-end gap-2 mb-6">
              <input value={newSh.name} onChange={(e) => setNewSh({ ...newSh, name: e.target.value })} placeholder="Название (напр. Ночная)" className="h-9 rounded border border-gray-300 px-2 w-52" />
              <input type="time" value={newSh.from} onChange={(e) => setNewSh({ ...newSh, from: e.target.value })} className="h-9 rounded border border-gray-300 px-2" />
              <input type="time" value={newSh.to} onChange={(e) => setNewSh({ ...newSh, to: e.target.value })} className="h-9 rounded border border-gray-300 px-2" />
              <button onClick={() => { if (newSh.name.trim()) { addShiftType(newSh.name.trim(), newSh.from, newSh.to); setNewSh({ name: '', from: '09:00', to: '18:00' }) } }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить смену</button>
            </div>

            {/* Phase 5: медкнижки (сроки) */}
            <div className="text-gray-500 text-xs uppercase mb-2">Медкнижки (сроки действия)</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Сотрудник</th><th>Действует до</th><th className="text-right p-2">Статус</th></tr></thead>
                <tbody>
                  {staffList.map((s) => {
                    const exp = medChecks[s.id] ?? ''
                    const today = todayISO()
                    const days = exp ? Math.round((fromISO(exp).getTime() - fromISO(today).getTime()) / 86400000) : null
                    return (
                      <tr key={s.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{s.name}</td>
                        <td><input type="date" value={exp} onChange={(e) => setMedCheck(s.id, e.target.value)} className="h-8 rounded border border-gray-200 px-2" /></td>
                        <td className="text-right p-2">
                          {days == null ? <span className="text-gray-300 text-xs">не задана</span>
                            : days < 0 ? <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">просрочена</span>
                            : days <= 30 ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">истекает через {days} дн.</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">действует</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : section === 'stock' ? (
          <div className="p-6 max-w-3xl">
            <div className="text-xs text-gray-500 mb-5">
              Номенклатура и остатки (приход/инвентаризация — офисный контур). Касса списывает по техкартам при продаже.
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Товары на складе</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-6">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2 font-medium">Артикул</th><th className="p-2 font-medium">Товар</th><th className="p-2 font-medium">Ед.</th>
                  <th className="p-2 font-medium text-right">Себест.</th><th className="p-2 font-medium text-right">Мин.</th><th className="p-2 font-medium text-right">Остаток (факт)</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {ingredients.map((i) => (
                    <tr key={i.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2 font-mono text-xs text-gray-400">{i.code}</td>
                      <td className="p-2">{i.name}</td>
                      <td className="p-2 text-gray-500">{i.unit}</td>
                      <td className="p-2 text-right text-gray-600">{formatTenge(i.costPerUnit)}</td>
                      <td className="p-2 text-right text-gray-400">{i.min}</td>
                      <td className="p-2 text-right">
                        <input type="number" value={i.stock} min={0}
                          onChange={(e) => setIngredientStock(i.id, Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-24 h-8 rounded border border-gray-300 px-2 text-right" />
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => setRecvItem({ id: i.id, name: i.name, unit: i.unit })}
                          className="h-8 px-3 rounded bg-emerald-500 text-white text-xs">+ Приход</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Техкарты (редактирование)</div>
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Блюдо:</span>
                <select value={editDish} onChange={(e) => setEditDish(e.target.value)} className="h-9 rounded border border-gray-300 px-2">
                  <option value="">— выберите —</option>
                  {dishes.filter((d) => techCards[d.id] || techCardOverrides[d.id]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {editDish && <span className="ml-auto text-sm text-gray-400">Себест.: {formatTenge(dishCost(editDish, ingredients, techCardOverrides))} · выход: {(() => { const y = dishYield(editDish, ingredients, techCardOverrides); return y > 0 ? String(y).replace('.', ',') : '—' })()} · доступно: {(() => { const m = dishMaxPortions(editDish, ingredients, techCardOverrides); return m === Infinity ? '∞' : m })()}</span>}
              </div>
              {!editDish ? <div className="text-gray-400 text-sm">Выберите блюдо для правки рецепта. Списание и себестоимость считаются по брутто; потери (хол./гор. обработка) дают нетто и выход. Изменения сразу влияют на списание со склада на кассе.</div> : (() => {
                const card = techCardOverrides[editDish] ?? techCards[editDish] ?? []
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                      <span className="flex-1">Ингредиент</span>
                      <span className="w-20 text-right">Брутто</span>
                      <span className="w-16 text-right">Потери хол.%</span>
                      <span className="w-16 text-right">Нетто</span>
                      <span className="w-16 text-right">Потери гор.%</span>
                      <span className="w-16 text-right">Выход</span>
                      <span className="w-6"></span>
                    </div>
                    {card.map((it, idx) => {
                      const ing = ingredients.find((x) => x.id === it.ingredientId)
                      const upd = (patch: Partial<typeof it>) => setTechCard(editDish, card.map((c, i) => i === idx ? { ...c, ...patch } : c))
                      return (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <select value={it.ingredientId} onChange={(e) => upd({ ingredientId: e.target.value })}
                            className="h-9 rounded border border-gray-300 px-2 flex-1">
                            {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                          </select>
                          <input type="number" step="0.001" min={0} value={it.gross}
                            onChange={(e) => upd({ gross: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-20 h-9 rounded border border-gray-300 px-2 text-right" />
                          <input type="number" step="1" min={0} max={99} value={it.coldLossPct ?? 0}
                            onChange={(e) => upd({ coldLossPct: Math.min(99, Math.max(0, parseFloat(e.target.value) || 0)) })}
                            className="w-16 h-9 rounded border border-gray-300 px-2 text-right" />
                          <span className="w-16 text-right text-sm text-gray-500">{String(itemNetto(it)).replace('.', ',')}</span>
                          <input type="number" step="1" min={0} max={99} value={it.hotLossPct ?? 0}
                            onChange={(e) => upd({ hotLossPct: Math.min(99, Math.max(0, parseFloat(e.target.value) || 0)) })}
                            className="w-16 h-9 rounded border border-gray-300 px-2 text-right" />
                          <span className="w-16 text-right text-sm text-gray-500">{String(itemYield(it)).replace('.', ',')} {ing?.unit}</span>
                          <button onClick={() => setTechCard(editDish, card.filter((_, i) => i !== idx))} className="w-6 text-gray-400 hover:text-red-500" title="Убрать">✕</button>
                        </div>
                      )
                    })}
                    {card.length === 0 && <div className="text-gray-400 text-sm mb-2">Пустая техкарта (блюдо ничего не списывает).</div>}
                    <button onClick={() => setTechCard(editDish, [...card, { ingredientId: ingredients[0].id, gross: 0.1 }])}
                      className="h-9 px-3 rounded bg-emerald-500 text-white text-sm">+ Ингредиент</button>
                  </div>
                )
              })()}
            </div>
          </div>
        ) : section === 'reports' ? (
          <div className="p-6 max-w-5xl">
            <div className="text-xs text-gray-500 mb-4">
              Отчёты строятся из закрытых чеков кассы и склада (как OLAP/складские отчёты iikoOffice). Период = текущая открытая смена (мок).
            </div>

            {/* сводка-шапка */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <OfficeStat label="Выручка" value={formatTenge(revenue)} />
              <OfficeStat label="Чеков" value={String(closedOrders.length)} />
              <OfficeStat label="Средний чек" value={formatTenge(avg)} />
              <OfficeStat label="Возвраты" value={formatTenge(refSum)} />
            </div>

            {/* вкладки отчётов */}
            <Tabs active={report} onChange={setReport}
              items={[
                { id: 'sales', label: 'Продажи за период' }, { id: 'avg', label: 'Средний чек' }, { id: 'unsold', label: 'Непродаваемые' }, { id: 'purchases', label: 'Закупки' }, { id: 'stock', label: 'Остатки на складах' }, { id: 'vat', label: 'ҚҚС (НДС)' }, { id: 'olap', label: 'OLAP-отчёт' }, { id: 'pnl', label: 'Прибыли и убытки' },
              ]}
              right={<>
                {(report === 'sales' || report === 'avg' || report === 'unsold' || report === 'purchases' || report === 'stock' || report === 'vat') && (
                  <button onClick={exportExcel} className="ml-auto h-8 self-center px-3 rounded bg-emerald-600 text-white text-xs">Excel…</button>
                )}
                <button onClick={exportTo1C} className={`${report === 'sales' || report === 'avg' || report === 'unsold' || report === 'purchases' || report === 'stock' || report === 'vat' ? '' : 'ml-auto'} h-8 self-center px-3 rounded bg-slate-700 text-white text-xs`}>Выгрузить в 1С (JSON)</button>
              </>} />

            {/* 1. Продажи за период */}
            {report === 'sales' && (
              <div>
                <div className="flex gap-2 mb-3">
                  {([['byDish', 'По блюдам'], ['byDay', 'По дням']] as const).map(([m, l]) => (
                    <button key={m} onClick={() => setSalesMode(m)} className={`h-8 px-3 rounded text-sm ${salesMode === m ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                  {salesMode === 'byDish' ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                        <th className="p-2">Блюдо</th><th className="text-right">Кол-во</th><th className="text-right">Выручка</th><th className="text-right">ҚҚС</th><th className="text-right">Без НДС</th><th className="text-right">Себест.</th><th className="text-right">Валовая</th><th className="text-right p-2">Наценка %</th>
                      </tr></thead>
                      <tbody>
                        {salesByDish.length === 0 ? <tr><td colSpan={8} className="p-3 text-gray-400">Нет продаж.</td></tr> : salesByDish.map((d) => {
                          const gross = +(noVat(d.rev, d.vat) - d.cost).toFixed(2)
                          const markup = d.cost > 0 ? Math.round(gross / d.cost * 100) : 0
                          return (
                            <tr key={d.name} className="border-b border-gray-100 last:border-0">
                              <td className="p-2">{d.name}</td>
                              <td className="text-right">{+d.qty.toFixed(2)}</td>
                              <td className="text-right">{formatTenge(d.rev)}</td>
                              <td className="text-right text-gray-400">{d.vat}%</td>
                              <td className="text-right text-gray-500">{formatTenge(noVat(d.rev, d.vat))}</td>
                              <td className="text-right text-gray-500">{formatTenge(d.cost)}</td>
                              <td className="text-right font-medium">{formatTenge(gross)}</td>
                              <td className="text-right p-2 text-gray-600">{d.cost > 0 ? `${markup}%` : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Дата</th><th className="text-right">Чеков</th><th className="text-right">Выручка</th><th className="text-right p-2">Средний чек</th></tr></thead>
                      <tbody>
                        {salesByDay.length === 0 ? <tr><td colSpan={4} className="p-3 text-gray-400">Нет продаж.</td></tr> : salesByDay.map((d) => (
                          <tr key={d.day} className="border-b border-gray-100 last:border-0">
                            <td className="p-2">{d.day}</td><td className="text-right">{d.checks}</td><td className="text-right">{formatTenge(d.rev)}</td><td className="text-right p-2">{formatTenge(d.rev / d.checks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* 1b. Отчёт о среднем чеке (topic-603) */}
            {report === 'avg' && (
              <div>
                <div className="text-xs text-gray-500 mb-3">Посещаемость и покупательная способность по учётным дням. Детализация — по дням (период = текущая смена, мок). Формулы 1:1 с iiko.</div>
                <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                      <th className="p-2">Дата</th><th className="text-right">Чеков</th><th className="text-right">Гостей</th><th className="text-right">Продажи</th><th className="text-right">Средний чек</th><th className="text-right">Средний заказ гостя</th><th className="text-right p-2">Ср. гостей на заказ</th>
                    </tr></thead>
                    <tbody>
                      {avgByDay.length === 0 ? <tr><td colSpan={7} className="p-3 text-gray-400">Нет продаж.</td></tr> : avgByDay.map((d) => (
                        <tr key={d.day} className="border-b border-gray-100 last:border-0">
                          <td className="p-2">{d.day}</td>
                          <td className="text-right">{d.checks}</td>
                          <td className="text-right">{d.guests}</td>
                          <td className="text-right">{formatTenge(d.sales)}</td>
                          <td className="text-right">{formatTenge(avgCheck(d.sales, d.checks))}</td>
                          <td className="text-right text-gray-600">{formatTenge(avgGuestOrder(d.sales, d.guests))}</td>
                          <td className="text-right p-2 text-gray-600">{avgGuestsPer(d.sales, d.checks, d.guests).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {avgByDay.length > 0 && (
                      <tfoot><tr className="border-t border-gray-200 font-semibold">
                        <td className="p-2">Итого</td>
                        <td className="text-right">{avgTot.checks}</td>
                        <td className="text-right">{avgTot.guests}</td>
                        <td className="text-right">{formatTenge(avgTot.sales)}</td>
                        <td className="text-right">{formatTenge(avgCheck(avgTot.sales, avgTot.checks))}</td>
                        <td className="text-right">{formatTenge(avgGuestOrder(avgTot.sales, avgTot.guests))}</td>
                        <td className="text-right p-2">{avgGuestsPer(avgTot.sales, avgTot.checks, avgTot.guests).toFixed(2)}</td>
                      </tr></tfoot>
                    )}
                  </table>
                </div>
                <div className="text-xs text-gray-400 mt-2">Средний чек = Продажи / Чеки · Средний заказ гостя = Продажи / Гости · Ср. гостей на заказ = Средний чек / Средний заказ гостя.</div>
              </div>
            )}

            {/* 1c. Непродаваемые блюда (topic-621) */}
            {report === 'unsold' && (
              <div>
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <span className="text-gray-500">Показывать блюда с продажами не более</span>
                  <input value={unsoldMax} onChange={(e) => setUnsoldMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                    className="h-8 w-16 rounded border border-gray-300 px-2 text-right" />
                  <span className="text-gray-500">шт за период</span>
                  <span className="ml-auto text-gray-500">Найдено: <b className="text-gray-800">{unsoldRows.length}</b></span>
                </div>
                <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                      <th className="p-2">Название</th><th>Группа</th><th className="text-right p-2">Продано (шт)</th>
                    </tr></thead>
                    <tbody>
                      {unsoldRows.length === 0 ? <tr><td colSpan={3} className="p-3 text-gray-400">Нет блюд по критерию (все продаются лучше порога).</td></tr> : unsoldRows.map((x) => (
                        <tr key={x.d.id} className="border-b border-gray-100 last:border-0">
                          <td className="p-2">{x.d.name}</td>
                          <td className="text-gray-500">{x.group}</td>
                          <td className={`text-right p-2 ${x.qty === 0 ? 'text-rose-600 font-medium' : 'text-gray-700'}`}>{x.qty === 0 ? '0 (не продавалось)' : x.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-400 mt-2">Блюда «в продаже на период» с количеством продаж ≤ порога. Красным — не продавались ни разу. Детализация по официантам/ТП — бэклог.</div>
              </div>
            )}

            {/* 1d. Отчёт о закупках (topic-607) */}
            {report === 'purchases' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {([['bySupplier', 'По поставщикам'], ['byStore', 'По складам']] as const).map(([m, l]) => (
                    <button key={m} onClick={() => setPurchMode(m)} className={`h-8 px-3 rounded text-sm ${purchMode === m ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
                  ))}
                  <span className="ml-auto text-sm text-gray-500">Всего закупок: <b className="text-gray-800">{formatTenge(purchTotal)}</b></span>
                </div>
                <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                  {purchMode === 'bySupplier' ? (
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                        <th className="p-2">Поставщик</th><th className="text-right">Накладных</th><th className="text-right">Сумма</th><th className="text-right">в т.ч. ҚҚС</th><th className="text-right p-2">Доля %</th>
                      </tr></thead>
                      <tbody>
                        {purchBySupplier.length === 0 ? <tr><td colSpan={5} className="p-3 text-gray-400">Нет приходных накладных.</td></tr> : purchBySupplier.map((s) => (
                          <tr key={s.name} className="border-b border-gray-100 last:border-0">
                            <td className="p-2">{s.name}</td>
                            <td className="text-right">{s.count}</td>
                            <td className="text-right">{formatTenge(s.sum)}</td>
                            <td className="text-right text-gray-500">{formatTenge(s.vat)}</td>
                            <td className="text-right p-2 text-gray-600">{share(s.sum)}%</td>
                          </tr>
                        ))}
                      </tbody>
                      {purchBySupplier.length > 0 && <tfoot><tr className="border-t border-gray-200 font-semibold"><td className="p-2">Итого</td><td className="text-right">{purchBySupplier.reduce((a, s) => a + s.count, 0)}</td><td className="text-right">{formatTenge(purchTotal)}</td><td className="text-right">{formatTenge(purchBySupplier.reduce((a, s) => a + s.vat, 0))}</td><td className="text-right p-2">100%</td></tr></tfoot>}
                    </table>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                        <th className="p-2">Склад-получатель</th><th className="text-right">Накладных</th><th className="text-right">Сумма</th><th className="text-right p-2">Доля %</th>
                      </tr></thead>
                      <tbody>
                        {purchByStore.length === 0 ? <tr><td colSpan={4} className="p-3 text-gray-400">Нет приходных накладных.</td></tr> : purchByStore.map((s) => (
                          <tr key={s.store} className="border-b border-gray-100 last:border-0">
                            <td className="p-2">{s.store}</td>
                            <td className="text-right">{s.count}</td>
                            <td className="text-right">{formatTenge(s.sum)}</td>
                            <td className="text-right p-2 text-gray-600">{share(s.sum)}%</td>
                          </tr>
                        ))}
                      </tbody>
                      {purchByStore.length > 0 && <tfoot><tr className="border-t border-gray-200 font-semibold"><td className="p-2">Итого</td><td className="text-right">{purchByStore.reduce((a, s) => a + s.count, 0)}</td><td className="text-right">{formatTenge(purchTotal)}</td><td className="text-right p-2">100%</td></tr></tfoot>}
                    </table>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-2">Источник — приходные накладные (входящие ЭСФ) из «Бухгалтерия». Доля % — от общего объёма закупок за период. Отклонение цены от прайс-листа поставщика — бэклог (прайс-листов нет).</div>
              </div>
            )}

            {/* 2. Остатки на складах */}
            {report === 'stock' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {([['all', 'Все'], ['belowMin', 'Ниже минимума'], ['zero', 'Нулевые'], ['neg', 'Отрицательные']] as const).map(([c, l]) => (
                    <button key={c} onClick={() => setStockCrit(c)} className={`h-8 px-3 rounded text-sm ${stockCrit === c ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
                  ))}
                  <span className="ml-auto text-sm text-gray-500">Стоимость остатков: <b className="text-gray-800">{formatTenge(stockValue)}</b></span>
                </div>
                <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                      <th className="p-2">Артикул</th><th>Товар</th><th>Ед.</th><th className="text-right">Остаток</th><th className="text-right">Мин.</th><th className="text-right">Себест/ед</th><th className="text-right p-2">Сумма</th>
                    </tr></thead>
                    <tbody>
                      {stockRows.length === 0 ? <tr><td colSpan={7} className="p-3 text-gray-400">Нет позиций по критерию.</td></tr> : stockRows.map((i) => {
                        const cls = i.stock < 0 ? 'text-red-600 font-medium' : i.stock < i.min ? 'text-orange-500 font-medium' : ''
                        return (
                          <tr key={i.id} className="border-b border-gray-100 last:border-0">
                            <td className="p-2 font-mono text-xs text-gray-400">{i.code}</td>
                            <td>{i.name}</td><td className="text-gray-500">{i.unit}</td>
                            <td className={`text-right ${cls}`}>{+i.stock.toFixed(3)}</td>
                            <td className="text-right text-gray-400">{i.min}</td>
                            <td className="text-right text-gray-500">{formatTenge(i.costPerUnit)}</td>
                            <td className="text-right p-2">{formatTenge(i.stock * i.costPerUnit)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-400 mt-2">Красный — отрицательный остаток, оранжевый — ниже минимума (как в iikoOffice).</div>
              </div>
            )}

            {/* 2b. ҚҚС (НДС) по ставкам — отчёт 011/041 */}
            {report === 'vat' && (
              <div className="max-w-2xl">
                <div className="text-xs text-gray-500 mb-3">Разбивка оборота по ставкам ҚҚС (мультиставка 16% / 0%). ҚҚС выделяется из суммы с налогом по каждой позиции чека.</div>
                <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                      <th className="p-2">Ставка ҚҚС</th><th className="text-right">Оборот (с ҚҚС)</th><th className="text-right">Без НДС</th><th className="text-right p-2">Сумма ҚҚС</th>
                    </tr></thead>
                    <tbody>
                      {vatRowsKz.length === 0 ? <tr><td colSpan={4} className="p-3 text-gray-400">Нет продаж.</td></tr> : vatRowsKz.map((r) => (
                        <tr key={r.rate} className="border-b border-gray-100 last:border-0">
                          <td className="p-2">{r.rate}%{r.rate === 0 ? ' (без НДС)' : ''}</td>
                          <td className="text-right">{formatTenge(r.gross)}</td>
                          <td className="text-right text-gray-500">{formatTenge(r.net)}</td>
                          <td className="text-right p-2">{formatTenge(r.vat)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t border-gray-200 font-semibold">
                      <td className="p-2">Итого</td>
                      <td className="text-right">{formatTenge(vatRowsKz.reduce((s, r) => s + r.gross, 0))}</td>
                      <td className="text-right">{formatTenge(netRevenue)}</td>
                      <td className="text-right p-2">{formatTenge(vatKz)}</td>
                    </tr></tfoot>
                  </table>
                </div>
                <div className="text-xs text-gray-400 mt-2">🇰🇿 ҚҚС 16% (с 01.01.2026) · 0% — необлагаемые/без НДС позиции (напр. услуга доставки). К уплате в КГД: <b className="text-gray-700">{formatTenge(vatKz)}</b>.</div>
              </div>
            )}

            {/* 3. OLAP-куб (сводная таблица) */}
            {report === 'olap' && <OfficeOlap />}

            {/* 4. P&L */}
            {report === 'pnl' && (
              <div className="max-w-xl">
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  {[
                    ['Выручка (с ҚҚС)', revenue, false],
                    [multiRateKz ? 'ҚҚС (в т.ч., все ставки)' : 'ҚҚС 16% (в т.ч.)', -vatKz, false],
                    ['Выручка без НДС', netRevenue, true],
                    ['Себестоимость проданного', -cogs, false],
                    ['Валовая прибыль', grossProfit, true],
                    ['ФОТ (оклады)', -payrollBase, false],
                    ['Взносы работодателя (ОПВР 3,5% / ООСМС 3% / СО 5% / СН 6%)', -(payrollEmployer - payrollBase), false],
                    ['Операционная прибыль', opProfit, true],
                  ].map(([label, val, bold]) => (
                    <div key={label as string} className={`flex justify-between px-4 h-11 items-center border-b border-gray-100 last:border-0 ${bold ? 'font-semibold bg-gray-50' : ''}`}>
                      <span>{label as string}</span>
                      <span className={(val as number) < 0 ? 'text-red-600' : ''}>{formatTenge(val as number)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-2">Упрощённый P&L: себестоимость — по техкартам проданных блюд; ФОТ — из раздела «Зарплата». Полный P&L (с проводками/арендой/прочими расходами) — на .NET.</div>
              </div>
            )}
          </div>
        ) : section === 'accounting' ? (
          <div className="p-6 max-w-3xl">
            <div className="text-xs text-gray-500 mb-5">
              KZ-бухгалтерия: налоги с продаж (ҚҚС), контрагенты (БИН/ИИН) и приходные накладные → входящие ЭСФ.
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Налоги с продаж (KZ)</div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <OfficeStat label="Выручка" value={formatTenge(revenue)} />
              <OfficeStat label={multiRateKz ? 'ҚҚС к уплате (16%/0%)' : 'ҚҚС 16% к уплате'} value={formatTenge(vatKz)} />
              <OfficeStat label="Без НДС" value={formatTenge(netRevenue)} />
              <OfficeStat label="СНО · БИН" value="ОУР · 123456789012" />
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Контрагенты (поставщики)</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-2">
              {contractors.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 h-11 border-b border-gray-100 last:border-0">
                  <span className="flex-1">{c.name}</span>
                  <span className="text-gray-500 font-mono text-xs">БИН/ИИН {c.bin}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-6">
              <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Наименование" className="h-9 rounded border border-gray-300 px-2 flex-1" />
              <input value={cBin} onChange={(e) => setCBin(e.target.value)} placeholder="БИН / ИИН" className="h-9 rounded border border-gray-300 px-2 w-40" />
              <button onClick={() => { addContractor(cName.trim(), cBin.trim()); setCName(''); setCBin('') }} className="h-9 px-4 rounded bg-blue-600 text-white text-sm">Добавить</button>
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Приходная накладная → входящая ЭСФ</div>
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
              {/* ШАПКА накладной */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <label className="flex flex-col text-xs text-gray-500 col-span-2">Поставщик
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm">
                    <option value="">— выберите —</option>
                    {contractors.map((c) => <option key={c.id} value={c.id}>{c.name} (БИН {c.bin})</option>)}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-gray-500">Склад-получатель
                  <select value={pStore} onChange={(e) => setPStore(e.target.value)} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm">
                    {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-gray-500">Дата накладной
                  <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm" />
                </label>
                <label className="flex flex-col text-xs text-gray-500">№ накладной
                  <input value={pNo} onChange={(e) => setPNo(e.target.value)} placeholder="авто (ПН-…)" className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm" />
                </label>
                <label className="flex flex-col text-xs text-gray-500">№ ЭСФ
                  <input value={pEsf} onChange={(e) => setPEsf(e.target.value)} placeholder="авто (ESF-KZ-…)" className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm font-mono" />
                </label>
              </div>
              {/* ТАБЛИЧНАЯ ЧАСТЬ — добавление строки */}
              <div className="flex items-end gap-2 mb-3">
                <select value={pIng} onChange={(e) => setPIng(e.target.value)} className="h-9 rounded border border-gray-300 px-2 flex-1">
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
                <input value={pQty} onChange={(e) => setPQty(e.target.value)} inputMode="decimal" placeholder="кол-во" className="w-24 h-9 rounded border border-gray-300 px-2 text-right" />
                <input value={pPrice} onChange={(e) => setPPrice(e.target.value)} inputMode="decimal" placeholder="цена ₸" className="w-28 h-9 rounded border border-gray-300 px-2 text-right" />
                <button onClick={addPLine} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">+ строка</button>
              </div>
              {pLines.length > 0 && (() => {
                const subtotal = pLines.reduce((s, l) => s + l.qty * l.price, 0)
                const vatIncl = +(subtotal - subtotal / 1.16).toFixed(2)
                return (
                  <div className="border border-gray-100 rounded mb-3 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-400 text-xs text-left border-b border-gray-100">
                        <th className="px-3 py-1.5">Товар</th><th className="text-right">Кол-во</th><th className="text-right">Цена</th><th className="text-right">Сумма</th><th className="text-right">ҚҚС 16%</th><th className="px-2"></th>
                      </tr></thead>
                      <tbody>
                        {pLines.map((l) => {
                          const sum = l.qty * l.price
                          return (
                            <tr key={l.ingredientId} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-1.5">{l.name}</td>
                              <td className="text-right text-gray-500">{l.qty}</td>
                              <td className="text-right text-gray-500">{formatTenge(l.price)}</td>
                              <td className="text-right">{formatTenge(sum)}</td>
                              <td className="text-right text-gray-500">{formatTenge(sum - sum / 1.16)}</td>
                              <td className="px-2 text-right"><button onClick={() => setPLines((ls) => ls.filter((x) => x.ingredientId !== l.ingredientId))} className="text-gray-400 hover:text-red-500">✕</button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t border-gray-200"><td className="px-3 py-1.5" colSpan={3}>Итого (с ҚҚС)</td><td className="text-right">{formatTenge(subtotal)}</td><td className="text-right text-gray-600">{formatTenge(vatIncl)}</td><td /></tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()}
              <button onClick={provesti} disabled={!supplierId || pLines.length === 0}
                className={`h-9 px-4 rounded text-sm ${supplierId && pLines.length ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Провести (приход на «{pStore}» + ЭСФ)</button>
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Входящие ЭСФ / приходные</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              {incoming.length === 0 ? <div className="p-3 text-gray-400 text-sm">Накладных пока нет.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">№</th><th>Дата</th><th>Поставщик</th><th>Склад</th><th className="text-right">Сумма</th><th className="text-right">ҚҚС</th><th className="p-2">ЭСФ</th></tr></thead>
                  <tbody>
                    {incoming.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{inv.no}</td><td>{inv.date.split(',')[0]}</td><td>{inv.supplierName}</td><td className="text-gray-500">{inv.store ?? '—'}</td>
                        <td className="text-right">{formatTenge(inv.total)}</td><td className="text-right">{formatTenge(inv.vat)}</td><td className="p-2 font-mono text-xs">{inv.esfNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="text-gray-500 text-xs uppercase mt-6 mb-2">Исходящие ЭСФ (покупателю)</div>
            <div className="flex gap-2 mb-2">
              <select value={outBuyer} onChange={(e) => setOutBuyer(e.target.value)} className="h-9 rounded border border-gray-300 px-2 flex-1">
                <option value="">— покупатель —</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name} (БИН {c.bin})</option>)}
              </select>
              <input value={outAmount} onChange={(e) => setOutAmount(e.target.value)} inputMode="decimal" placeholder="сумма ₸" className="w-32 h-9 rounded border border-gray-300 px-2 text-right" />
              <button onClick={() => { const a = parseFloat(outAmount.replace(',', '.')); if (outBuyer && a > 0) { const inv = addOutEsf(outBuyer, a); if (inv) { printToast(`Исходящая ЭСФ ${inv.esfNo} выписана`); setOutAmount('') } } }}
                className="h-9 px-4 rounded bg-blue-600 text-white text-sm">Выписать ЭСФ</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              {outgoing.length === 0 ? <div className="p-3 text-gray-400 text-sm">Исходящих ЭСФ нет.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">№</th><th>Дата</th><th>Покупатель</th><th className="text-right">Сумма</th><th className="text-right">ҚҚС</th><th className="p-2">ЭСФ</th></tr></thead>
                  <tbody>
                    {outgoing.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{inv.no}</td><td>{inv.date.split(',')[0]}</td><td>{inv.supplierName}</td>
                        <td className="text-right">{formatTenge(inv.total)}</td><td className="text-right">{formatTenge(inv.vat)}</td><td className="p-2 font-mono text-xs">{inv.esfNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : section === 'payroll' ? (
          <div className="p-6 max-w-5xl">
            <div className="text-xs text-gray-500 mb-4">
              Платёжная ведомость (iikoOffice), <b>связана с кассой</b>: повременная база = <b>часы из явок</b> × ставка, премия = <b>личные продажи</b> в закрытых заказах (мотивация), выдача = <b>изъятие наличных из кассы</b> (отчёт 038).
              🇰🇿 Налоги РК 2026: удержания — ОПВ 10%, ВОСМС 2%, ИПН 10% (вычет ОПВ+ВОСМС+30 МРП); работодатель — ОПВР 3,5%, ООСМС 3%, СО 5%, соцналог 6%.
              «К выплате» = база − налоги + премия − штрафы.
            </div>

            {/* сводка: начислено / премия / выдано авансов / расчёта / осталось */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              <OfficeStat label="К выплате (ФОТ)" value={formatTenge(totNet)} />
              <OfficeStat label="Премии (мотивация)" value={formatTenge(totPremium)} />
              <OfficeStat label="Выдано авансов" value={formatTenge(totAdvance)} />
              <OfficeStat label="Выдано расчёта" value={formatTenge(totSettle)} />
              <OfficeStat label="Осталось выдать" value={formatTenge(totRemaining)} />
            </div>

            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-6">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2">Сотрудник</th><th>Тип оплаты</th><th className="text-right">Часы (явки)</th><th className="text-right">Оклад / ставка</th><th className="text-right">База ₸</th><th className="text-right">Налоги</th><th className="text-right">Премия</th><th className="text-right">Удержано</th><th className="text-right">К выплате</th>
                  <th className="text-right">Аванс</th><th className="text-right">Расчёт</th><th className="text-right">Остаток</th><th className="p-2 text-center">Действия</th>
                </tr></thead>
                <tbody>
                  {payrollRows.map(({ p, okl, mode, hours, rate, opv, vosms, ipn, opvr, oosms, so, sn, premium, deduction, net, advance, settle, remaining }) => {
                    const advanceAmt = Math.min(remaining, Math.round(net * 0.4)) // аванс ≈ 40% от начисленного
                    return (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{p.name}<div className="text-xs text-gray-400">{p.positions[0]}</div></td>
                        <td>
                          <button onClick={() => setPayProfile(p.id, { mode: mode === 'hourly' ? 'salary' : 'hourly' })}
                            className={`h-7 px-2 rounded text-xs ${mode === 'hourly' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>{mode === 'hourly' ? 'повременная' : 'оклад'}</button>
                        </td>
                        <td className="text-right text-gray-500">{mode === 'hourly' ? `${hours} ч` : '—'}</td>
                        <td className="text-right">
                          {mode === 'hourly'
                            ? <span className="inline-flex items-center gap-1"><input type="number" value={rate} min={0} onChange={(e) => setPayProfile(p.id, { rate: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-20 h-8 rounded border border-gray-300 px-2 text-right" /><span className="text-gray-400 text-xs">/ч</span></span>
                            : <input type="number" value={okladOf(p.id)} min={0} onChange={(e) => setPayProfile(p.id, { oklad: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-24 h-8 rounded border border-gray-300 px-2 text-right" />}
                        </td>
                        <td className="text-right text-gray-600">{formatTenge(okl)}</td>
                        <td className="text-right text-gray-500" title={`Удержано: ОПВ ${opv} · ВОСМС ${vosms} · ИПН ${ipn}\nРаботодатель: ОПВР ${opvr} · ООСМС ${oosms} · СО ${so} · СН ${sn}`}>{formatTenge(opv + vosms + ipn)}</td>
                        <td className="text-right text-emerald-600">{premium > 0 ? '+' + formatTenge(premium) : <span className="text-gray-300">—</span>}</td>
                        <td className="text-right text-red-500">{deduction > 0 ? '−' + formatTenge(deduction) : <span className="text-gray-300">—</span>}</td>
                        <td className="text-right font-semibold">{formatTenge(net)}</td>
                        <td className="text-right text-gray-600">{advance > 0 ? formatTenge(advance) : <span className="text-gray-300">—</span>}</td>
                        <td className="text-right text-gray-600">{settle > 0 ? formatTenge(settle) : <span className="text-gray-300">—</span>}</td>
                        <td className={`text-right font-medium ${remaining > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{formatTenge(remaining)}</td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-center">
                            <button disabled={remaining <= 0 || advanceAmt <= 0}
                              onClick={() => { paySalary(p.id, 'advance', advanceAmt); printToast(`Аванс ${p.name}: ${formatTenge(advanceAmt)} — изъято из кассы`) }}
                              className={`h-7 px-2 rounded text-xs ${remaining > 0 && advanceAmt > 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Аванс</button>
                            <button disabled={remaining <= 0}
                              onClick={() => { paySalary(p.id, 'settlement', remaining); printToast(`Расчёт ${p.name}: ${formatTenge(remaining)} — изъято из кассы`) }}
                              className={`h-7 px-2 rounded text-xs ${remaining > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Расчёт</button>
                            <button onClick={() => setDeductStaff({ id: p.id, name: p.name })}
                              className="h-7 px-2 rounded text-xs bg-rose-100 text-rose-700">Штраф</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Мотивационные программы (премия за личные продажи) */}
            <div className="text-gray-500 text-xs uppercase mb-2">Мотивационные программы (премия за продажи в закрытых заказах)</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Активна</th><th>Название</th><th>На что</th><th>Начисление</th><th className="text-right">Порог</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {motivationPrograms.length === 0 ? <tr><td colSpan={6} className="p-3 text-gray-400">Программ нет.</td></tr> : motivationPrograms.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2"><input type="checkbox" checked={m.active} onChange={(e) => updateMotivation(m.id, { active: e.target.checked })} /></td>
                      <td>{m.name}</td>
                      <td className="text-gray-500 text-xs">{m.scope === 'all' ? 'все блюда' : m.scope === 'dish' ? (findDish(m.targetId ?? '')?.name ?? 'блюдо') : (menuGroups.find((g) => g.id === m.targetId)?.name ?? 'категория')}</td>
                      <td className="text-gray-600">{m.mode === 'percent' ? `${m.value}% с выручки` : `${formatTenge(m.value)} за ед.`}</td>
                      <td className="text-right text-gray-500">{m.minQty ? `от ${m.minQty} шт` : '—'}</td>
                      <td className="p-2 text-right"><button onClick={() => removeMotivation(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end gap-2 mb-6 bg-white border border-gray-200 rounded p-3">
              <input value={newMotiv.name} onChange={(e) => setNewMotiv({ ...newMotiv, name: e.target.value })} placeholder="Название" className="h-9 rounded border border-gray-300 px-2 flex-1 min-w-[150px]" />
              <select value={newMotiv.scope} onChange={(e) => setNewMotiv({ ...newMotiv, scope: e.target.value as 'all' | 'dish' | 'group', targetId: '' })} className="h-9 rounded border border-gray-300 px-2">
                <option value="all">Все блюда</option><option value="group">Категория</option><option value="dish">Блюдо</option>
              </select>
              {newMotiv.scope !== 'all' && (
                <select value={newMotiv.targetId} onChange={(e) => setNewMotiv({ ...newMotiv, targetId: e.target.value })} className="h-9 rounded border border-gray-300 px-2">
                  <option value="">— выбрать —</option>
                  {newMotiv.scope === 'group' ? menuGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>) : dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              <select value={newMotiv.mode} onChange={(e) => setNewMotiv({ ...newMotiv, mode: e.target.value as 'percent' | 'perUnit' })} className="h-9 rounded border border-gray-300 px-2">
                <option value="percent">% с выручки</option><option value="perUnit">₸ за единицу</option>
              </select>
              <input value={newMotiv.value} onChange={(e) => setNewMotiv({ ...newMotiv, value: e.target.value.replace(/[^\d.]/g, '') })} placeholder={newMotiv.mode === 'percent' ? '%' : '₸'} className="h-9 w-20 rounded border border-gray-300 px-2 text-right" />
              <input value={newMotiv.minQty} onChange={(e) => setNewMotiv({ ...newMotiv, minQty: e.target.value.replace(/\D/g, '') })} placeholder="порог шт" className="h-9 w-24 rounded border border-gray-300 px-2 text-right" />
              <button onClick={() => {
                const v = parseFloat(newMotiv.value) || 0
                if (!newMotiv.name.trim() || v <= 0 || (newMotiv.scope !== 'all' && !newMotiv.targetId)) return
                addMotivation({ name: newMotiv.name.trim(), scope: newMotiv.scope, targetId: newMotiv.targetId || undefined, mode: newMotiv.mode, value: v, minQty: newMotiv.minQty ? Number(newMotiv.minQty) : undefined, active: true })
                setNewMotiv({ name: '', scope: 'all', targetId: '', mode: 'percent', value: '', minQty: '' })
              }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить</button>
            </div>

            {/* история выплат (ведомость) */}
            <div className="text-gray-500 text-xs uppercase mb-2">История выплат</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              {salaryPayouts.length === 0 ? <div className="p-3 text-gray-400 text-sm">Выплат пока нет. «Аванс»/«Расчёт» создаёт изъятие наличных из кассы.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Дата</th><th>Сотрудник</th><th>Тип</th><th className="text-right p-2">Сумма</th></tr></thead>
                  <tbody>
                    {salaryPayouts.map((pay) => (
                      <tr key={pay.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{pay.at.split(',')[0]}</td>
                        <td>{staffList.find((s) => s.id === pay.staffId)?.name ?? '—'}</td>
                        <td><span className={`text-xs px-2 py-0.5 rounded-full ${pay.kind === 'advance' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{pay.kind === 'advance' ? 'аванс' : 'расчёт'}</span></td>
                        <td className="text-right p-2">{formatTenge(pay.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* удержания / штрафы */}
            <div className="text-gray-500 text-xs uppercase mt-6 mb-2">Удержания / штрафы</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              {salaryDeductions.length === 0 ? <div className="p-3 text-gray-400 text-sm">Удержаний нет. Кнопка «Штраф» в строке сотрудника уменьшает «к выплате».</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Дата</th><th>Сотрудник</th><th>Причина</th><th className="text-right">Сумма</th><th className="p-2"></th></tr></thead>
                  <tbody>
                    {salaryDeductions.map((d) => (
                      <tr key={d.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{d.at.split(',')[0]}</td>
                        <td>{staffList.find((s) => s.id === d.staffId)?.name ?? '—'}</td>
                        <td className="text-gray-600">{d.reason}</td>
                        <td className="text-right text-red-500">−{formatTenge(d.amount)}</td>
                        <td className="p-2 text-right"><button onClick={() => removeDeduction(d.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : section === 'finance' ? (
          <div className="p-6 max-w-4xl">
            <div className="text-xs text-gray-500 mb-4">
              Финансы (Phase 7). <b>Кассовая книга</b> — хронология наличных операций с остатком; <b>ДДС</b> — притоки/оттоки денежных средств.
              Источник — наличные продажи, внесения/изъятия (вкл. инкассацию и выплаты ЗП), возвраты наличными, разменный фонд смены.
            </div>
            <Tabs active={financeTab} onChange={setFinanceTab} items={[
              { id: 'book', label: 'Кассовая книга' }, { id: 'cashflow', label: 'ДДС (приток/отток)' }, { id: 'ledger', label: 'Бухучёт (план/проводки/ОСВ/баланс)' },
            ]} />
            {financeTab === 'ledger' ? <OfficeLedger /> : (() => {
              const opening = cashShift?.openingCash ?? 0
              // разменный фонд показан отдельной строкой «начало смены»; его движение-внесение исключаем из «внесений», иначе двойной счёт
              const isFund = (m: { kind: 'in' | 'out'; type: string }) => m.kind === 'in' && /размен|фонд|начальн/i.test(m.type)
              const cashSalesRows = closedOrders.map((o) => ({ at: o.paidAt, label: `Продажа · чек №${o.id} (нал.)`, in: o.payments.filter((p) => p.paymentTypeId === 'p-cash').reduce((s, p) => s + p.amount, 0), out: 0 })).filter((r) => r.in > 0)
              const mvRows = cashMovements.filter((m) => !isFund(m)).map((m) => ({ at: m.at, label: `${m.kind === 'in' ? 'Внесение' : 'Изъятие'} · ${m.type}${m.comment ? ' · ' + m.comment : ''}`, in: m.kind === 'in' ? m.amount : 0, out: m.kind === 'out' ? m.amount : 0 }))
              const refundRows = refunds.filter((r) => r.method === 'cash').map((r) => ({ at: r.at, label: `Возврат нал. · заказ №${r.orderId}`, in: 0, out: r.amount }))
              const parseAt = (s: string) => { const m = /(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s); return m ? `${m[3]}${m[2]}${m[1]}${m[4]}${m[5]}${m[6] ?? '00'}` : s }
              const rows = [...cashSalesRows, ...mvRows, ...refundRows].sort((a, b) => parseAt(a.at).localeCompare(parseAt(b.at)))
              const cashSales = cashSalesRows.reduce((s, r) => s + r.in, 0)
              const cashIn = cashMovements.filter((m) => m.kind === 'in' && !isFund(m)).reduce((s, m) => s + m.amount, 0) // внесения без разменного фонда
              const cashOut = cashMovements.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0)
              const refundsCash = refundRows.reduce((s, r) => s + r.out, 0)
              const closing = +(opening + cashSales + cashIn - cashOut - refundsCash).toFixed(2)
              if (!cashShift) return <div className="text-gray-400 text-sm">Кассовая смена закрыта — нет операций. Откройте смену на кассе.</div>
              if (financeTab === 'book') {
                let bal = opening
                return (
                  <div className="bg-white border border-gray-200 rounded-md overflow-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Время</th><th>Операция</th><th className="text-right">Приход</th><th className="text-right">Расход</th><th className="text-right p-2">Остаток</th></tr></thead>
                      <tbody>
                        <tr className="border-b border-gray-50"><td className="p-2 text-gray-400 text-xs">{cashShift.openedAt}</td><td>Разменный фонд (начало смены №{cashShift.no})</td><td className="text-right">{formatTenge(opening)}</td><td></td><td className="text-right p-2 font-medium">{formatTenge(opening)}</td></tr>
                        {rows.map((r, i) => { bal = +(bal + r.in - r.out).toFixed(2); return (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="p-2 text-gray-400 text-xs whitespace-nowrap">{r.at}</td><td>{r.label}</td>
                            <td className="text-right text-emerald-700">{r.in ? formatTenge(r.in) : ''}</td>
                            <td className="text-right text-rose-700">{r.out ? formatTenge(r.out) : ''}</td>
                            <td className="text-right p-2 font-medium">{formatTenge(bal)}</td>
                          </tr>
                        )})}
                      </tbody>
                      <tfoot><tr className="border-t border-gray-200 font-semibold"><td className="p-2" colSpan={4}>Остаток наличных в кассе</td><td className="text-right p-2">{formatTenge(closing)}</td></tr></tfoot>
                    </table>
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-2 gap-4 max-w-2xl">
                  <div className="bg-white border border-gray-200 rounded-md p-4">
                    <div className="text-emerald-700 text-sm font-medium mb-2">Притоки</div>
                    <FinRow k="Наличные продажи" v={formatTenge(cashSales)} />
                    <FinRow k="Внесения" v={formatTenge(cashIn)} />
                    <FinRow k="Итого приток" v={formatTenge(cashSales + cashIn)} b />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md p-4">
                    <div className="text-rose-700 text-sm font-medium mb-2">Оттоки</div>
                    <FinRow k="Изъятия (вкл. инкассацию, ЗП)" v={formatTenge(cashOut)} />
                    <FinRow k="Возвраты наличными" v={formatTenge(refundsCash)} />
                    <FinRow k="Итого отток" v={formatTenge(cashOut + refundsCash)} b />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4 col-span-2">
                    <FinRow k="Разменный фонд (начало)" v={formatTenge(opening)} />
                    <FinRow k="Чистый денежный поток" v={formatTenge(+(cashSales + cashIn - cashOut - refundsCash).toFixed(2))} />
                    <FinRow k="Остаток наличных (конец)" v={formatTenge(closing)} b />
                  </div>
                </div>
              )
            })()}
          </div>
        ) : section === 'journal' ? (
          <OfficeJournal />
        ) : section === 'delivery' ? (
          <OfficeDelivery />
        ) : section === 'admin' ? (
          <OfficeAdmin />
        ) : null}
      </div>

      {recvItem && (
        <InputModal title={`Приход на склад`} desc={`«${recvItem.name}» (${recvItem.unit})`}
          fields={[{ key: 'qty', label: `Количество, ${recvItem.unit}`, type: 'number', placeholder: '0' }]}
          okLabel="Оприходовать"
          onOk={(v) => { const n = parseFloat((v.qty || '').replace(',', '.')); if (n > 0) { receiveStock(recvItem.id, n); printToast(`Приход: ${recvItem.name} +${n} ${recvItem.unit}`) } setRecvItem(null) }}
          onCancel={() => setRecvItem(null)} />
      )}
      {deductStaff && (
        <InputModal title="Удержание / штраф" desc={deductStaff.name}
          fields={[{ key: 'amount', label: 'Сумма, ₸', type: 'number', placeholder: '0' }, { key: 'reason', label: 'Причина', placeholder: 'Штраф', default: 'Штраф' }]}
          okLabel="Удержать"
          onOk={(v) => { const a = parseFloat((v.amount || '').replace(',', '.')); if (a > 0) { addDeduction(deductStaff.id, a, v.reason.trim() || 'Штраф'); printToast(`Удержание ${deductStaff.name}: ${formatTenge(a)}`) } setDeductStaff(null) }}
          onCancel={() => setDeductStaff(null)} />
      )}
    </div>
  )
}

const OfficeStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white border border-gray-200 rounded-md p-4">
    <div className="text-xs text-gray-400">{label}</div>
    <div className="text-xl font-bold text-gray-800">{value}</div>
  </div>
)
const FinRow = ({ k, v, b }: { k: string; v: string; b?: boolean }) => (
  <div className={`flex justify-between py-0.5 text-sm ${b ? 'font-semibold border-t border-gray-200 mt-1 pt-1' : 'text-gray-600'}`}><span>{k}</span><span>{v}</span></div>
)
