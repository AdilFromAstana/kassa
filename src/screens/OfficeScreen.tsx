import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Monitor, Trash2, Plus } from 'lucide-react'
import { usePos, lineTotal } from '../store/pos'
import { printToast } from '../lib/print'
import { menuGroups, dishesByGroup, dishes, findDish } from '../mock/menu'
import { techCards, dishCost, dishMaxPortions } from '../mock/warehouse'
import { RIGHTS, POSITIONS } from '../lib/rights'
import { formatTenge } from '../lib/money'
import { todayISO, formatRu, fromISO, toISO } from '../lib/date'
import CalendarModal from '../components/CalendarModal'
import type { Establishment, PriceOrderLine, PaymentKind } from '../types'

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

type Section = 'settings' | 'menu' | 'prikazy' | 'retail' | 'discount' | 'staff' | 'stock' | 'reports' | 'accounting' | 'payroll'
const NAV: { id: Section; label: string }[] = [
  { id: 'settings', label: 'Настройки заведения' },
  { id: 'menu', label: 'Меню и цены' },
  { id: 'prikazy', label: 'Прейскурант (приказы)' },
  { id: 'retail', label: 'Розничные продажи' },
  { id: 'discount', label: 'Дисконтная система' },
  { id: 'staff', label: 'Сотрудники и права' },
  { id: 'stock', label: 'Номенклатура и техкарты' },
  { id: 'accounting', label: 'Бухгалтерия (KZ)' },
  { id: 'payroll', label: 'Зарплата (KZ)' },
  { id: 'reports', label: 'Отчёты' },
]
const SECTION_TITLE: Record<Section, string> = {
  settings: 'Настройки торгового предприятия', menu: 'Меню и цены', prikazy: 'Прейскурант — приказы об изменении цен',
  retail: 'Розничные продажи — типы оплат, внесений/изъятий, причины списания',
  discount: 'Дисконтная система — скидки/надбавки и клубные карты',
  staff: 'Сотрудники и права', stock: 'Номенклатура и техкарты', accounting: 'Бухгалтерия (KZ)', payroll: 'Зарплата (KZ)', reports: 'Отчёты',
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
  'Администратор': ['settings', 'menu', 'prikazy', 'retail', 'discount', 'staff', 'stock', 'accounting', 'payroll', 'reports'],
  'Управляющий': ['settings', 'menu', 'prikazy', 'retail', 'discount', 'stock', 'accounting', 'payroll', 'reports'],
  'Бухгалтер': ['accounting', 'payroll', 'reports', 'stock'],
}

export default function OfficeScreen() {
  const navigate = useNavigate()
  const { establishment: est, setEstablishment, priceOf, setDishPrice, roleRights, toggleRoleRight,
    ingredients, receiveStock, setIngredientStock, closedOrders, refunds, documents,
    techCardOverrides, setTechCard, contractors, invoices, addContractor, addPurchase, addOutEsf,
    staffList, addStaff, updateStaff, removeStaff, priceOrders, createPriceOrder, activatePriceOrder,
    salaryPayouts, paySalary,
    paymentTypes, addPaymentType, updatePaymentType, removePaymentType,
    cashOpTypes, addCashOpType, removeCashOpType, writeoffReasons, addWriteoffReason, removeWriteoffReason,
    discounts, addDiscount, updateDiscount, removeDiscount, clubCards, addClubCard, removeClubCard,
    motivationPrograms, addMotivation, updateMotivation, removeMotivation, salaryDeductions, addDeduction, removeDeduction } = usePos()
  const [section, setSection] = useState<Section>('settings')
  const [role, setRole] = useState<string>('Администратор')
  const [salary, setSalary] = useState<Record<string, number>>({})
  const allowed = ROLE_SECTIONS[role]
  const visibleNav = NAV.filter((n) => allowed.includes(n.id))
  useEffect(() => { if (!allowed.includes(section)) setSection(allowed[0]) }, [role]) // роль сменилась → перейти на доступный раздел
  const [editDish, setEditDish] = useState('')
  // бухгалтерия (KZ)
  const [cName, setCName] = useState(''); const [cBin, setCBin] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [pLines, setPLines] = useState<{ ingredientId: string; name: string; qty: number; price: number }[]>([])
  const [pIng, setPIng] = useState(ingredients[0]?.id ?? ''); const [pQty, setPQty] = useState(''); const [pPrice, setPPrice] = useState('')
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
  // дисконтная система (раздел discount)
  const [newDisc, setNewDisc] = useState({ name: '', kind: 'discount' as 'discount' | 'surcharge', percent: '', manual: true, byCard: false, minSum: '', fromTime: '', toTime: '' })
  const [newCard, setNewCard] = useState({ number: '', owner: '', discountId: '' })
  // мотивация (раздел payroll)
  const [newMotiv, setNewMotiv] = useState({ name: '', scope: 'all' as 'all' | 'dish' | 'group', targetId: '', mode: 'percent' as 'percent' | 'perUnit', value: '', minQty: '' })
  // отчёты (раздел reports)
  const [report, setReport] = useState<'sales' | 'stock' | 'olap' | 'pnl'>('sales')
  const [salesMode, setSalesMode] = useState<'byDish' | 'byDay'>('byDish')
  const [stockCrit, setStockCrit] = useState<'all' | 'belowMin' | 'zero' | 'neg'>('all')
  const [olapDim, setOlapDim] = useState<'day' | 'dish' | 'waiter' | 'payment'>('dish')
  const [olapMeasure, setOlapMeasure] = useState<'revenue' | 'checks' | 'qty'>('revenue')
  const addPLine = () => {
    const ing = ingredients.find((i) => i.id === pIng); const q = parseFloat(pQty.replace(',', '.')); const pr = parseFloat(pPrice.replace(',', '.'))
    if (!ing || !(q > 0) || !(pr > 0)) return
    setPLines((ls) => [...ls.filter((l) => l.ingredientId !== ing.id), { ingredientId: ing.id, name: ing.name, qty: q, price: pr }]); setPQty(''); setPPrice('')
  }
  const provesti = () => {
    if (!supplierId || pLines.length === 0) return
    const inv = addPurchase(supplierId, pLines)
    if (inv) { printToast(`Приходная ${inv.no} проведена · ЭСФ ${inv.esfNo}`); setPLines([]) }
  }

  // сводка для раздела «Отчёты»
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)
  const vatKz = +(revenue - revenue / 1.16).toFixed(2) // ҚҚС 16% в т.ч. с продаж
  const incoming = invoices.filter((i) => i.kind !== 'out')
  const outgoing = invoices.filter((i) => i.kind === 'out')
  const exportTo1C = () => {
    const data = { сформирован: 'демо', выручка: revenue, ҚҚС_к_уплате: vatKz, чеков: closedOrders.length, входящих_ЭСФ: invoices.length, накладные: invoices }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'iiko-1c-export.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  const avg = closedOrders.length ? revenue / closedOrders.length : 0
  const refSum = refunds.reduce((s, r) => s + r.amount, 0)

  // ───────── данные для отчётов (раздел reports) ─────────
  const noVat = (x: number) => +(x / 1.16).toFixed(2)
  const dayKey = (s: string) => s.split(',')[0] ?? s // fullNow() = "dd.mm.yyyy, hh:mm"
  const lineCost = (dishId: string, qty: number) => dishCost(dishId, ingredients, techCardOverrides) * qty

  // продажи по блюдам: выручка / себест. / валовая прибыль / наценка
  const salesByDish = Object.values(closedOrders.reduce((acc, o) => {
    for (const l of o.lines) {
      const a = (acc[l.dishId] ??= { name: l.name, qty: 0, rev: 0, cost: 0 })
      a.qty += l.qty; a.rev += lineTotal(l); a.cost += lineCost(l.dishId, l.qty)
    }
    return acc
  }, {} as Record<string, { name: string; qty: number; rev: number; cost: number }>)).sort((a, b) => b.rev - a.rev)

  // продажи по дням
  const salesByDay = Object.values(closedOrders.reduce((acc, o) => {
    const k = dayKey(o.paidAt)
    const a = (acc[k] ??= { day: k, checks: 0, rev: 0 })
    a.checks++; a.rev += o.total
    return acc
  }, {} as Record<string, { day: string; checks: number; rev: number }>))

  // остатки на складах + критерий
  const stockRows = ingredients.filter((i) =>
    stockCrit === 'belowMin' ? i.stock < i.min : stockCrit === 'zero' ? i.stock === 0 : stockCrit === 'neg' ? i.stock < 0 : true)
  const stockValue = ingredients.reduce((s, i) => s + i.stock * i.costPerUnit, 0)

  // OLAP-лайт: измерение × показатель
  const olapRows = (() => {
    const acc: Record<string, number> = {}
    const bump = (k: string, v: number) => { acc[k] = (acc[k] ?? 0) + v }
    for (const o of closedOrders) {
      if (olapDim === 'dish') for (const l of o.lines) bump(l.name, olapMeasure === 'revenue' ? lineTotal(l) : olapMeasure === 'checks' ? 1 : l.qty)
      else if (olapDim === 'payment') for (const p of o.payments) bump(p.name, olapMeasure === 'revenue' ? p.amount : olapMeasure === 'checks' ? 1 : 0)
      else {
        const k = olapDim === 'day' ? dayKey(o.paidAt) : (o.waiter || '—')
        bump(k, olapMeasure === 'revenue' ? o.total : olapMeasure === 'checks' ? 1 : o.lines.reduce((s, l) => s + l.qty, 0))
      }
    }
    return Object.entries(acc).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
  })()
  const olapMax = Math.max(1, ...olapRows.map((r) => r.v))
  const olapFmt = (v: number) => (olapMeasure === 'revenue' ? formatTenge(v) : String(+v.toFixed(olapMeasure === 'qty' ? 2 : 0)))

  // P&L (упрощённо): выручка без НДС − себестоимость проданного − ФОТ (оклады + СО 3.5%)
  const cogs = +closedOrders.reduce((s, o) => s + o.lines.reduce((x, l) => x + lineCost(l.dishId, l.qty), 0), 0).toFixed(2)
  const payrollBase = staffList.reduce((s, p) => s + (salary[p.id] ?? 250000), 0) // оклады (gross)
  const payrollEmployer = staffList.reduce((s, p) => s + kzTax(salary[p.id] ?? 250000).employerCost, 0) // полная стоимость ФОТ с взносами РК
  const grossProfit = +(noVat(revenue) - cogs).toFixed(2)
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

  // ───────── зарплата: начислено (оклад − налоги + премия − удержания) + выплаты (аванс/расчёт) ─────────
  const payrollOf = (staffId: string, staffName: string) => {
    const okl = salary[staffId] ?? 250000
    const t = kzTax(okl) // 🇰🇿 налоги РК 2026
    const premium = motivationOf(staffName)
    const deduction = salaryDeductions.filter((d) => d.staffId === staffId).reduce((s, d) => s + d.amount, 0)
    const net = +(t.net + premium - deduction).toFixed(2) // итого к выплате на руки
    const advance = salaryPayouts.filter((p) => p.staffId === staffId && p.kind === 'advance').reduce((s, p) => s + p.amount, 0)
    const settle = salaryPayouts.filter((p) => p.staffId === staffId && p.kind === 'settlement').reduce((s, p) => s + p.amount, 0)
    const remaining = +(net - advance - settle).toFixed(2)
    return { okl, ...t, premium, deduction, net, advance, settle, remaining }
  }
  // сводка по зарплате (для шапки раздела)
  const payrollRows = staffList.map((p) => ({ p, ...payrollOf(p.id, p.name) }))
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

        {section === 'settings' ? (
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
            {menuGroups.map((g) => {
              const items = dishesByGroup(g.id)
              if (!items.length) return null
              return (
                <div key={g.id} className="mb-6">
                  <div className="text-gray-500 text-xs uppercase mb-2">{g.name}</div>
                  <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                    {items.map((d) => {
                      const eff = priceOf(d.id, d.price)
                      const overridden = eff !== d.price
                      return (
                        <div key={d.id} className="flex items-center gap-3 px-4 h-14 border-b border-gray-100 last:border-0">
                          <span className="font-mono text-xs text-gray-400 w-12">{d.code}</span>
                          <span className="flex-1">{d.name}</span>
                          {overridden && <span className="text-xs text-gray-400 line-through">{formatTenge(d.price)}</span>}
                          <div className="flex items-center gap-1">
                            <input type="number" value={eff} min={0}
                              onChange={(e) => setDishPrice(d.id, Math.max(0, parseFloat(e.target.value) || 0))}
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
            <div className="text-xs text-gray-500 mb-5">
              Приказ об изменении цен (как в iikoOffice): набор новых цен + дата вступления в силу. <b>Активация</b> отправляет цены на кассу
              (раздел «Меню и цены» и цены новых позиций в заказе обновляются сразу).
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
                      ? <button onClick={() => { activatePriceOrder(o.id); printToast(`Приказ ${o.no} активирован — цены на кассе обновлены`) }} className="ml-auto h-8 px-3 rounded bg-blue-600 text-white text-xs">Активировать</button>
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

            <div className="text-gray-500 text-xs uppercase mb-2">Права по должностям</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-200">
                    <th className="p-2 font-medium">Право</th>
                    {POSITIONS.map((p) => <th key={p} className="p-2 font-medium text-center">{p}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(RIGHTS).map(([code, label]) => (
                    <tr key={code} className="border-b border-gray-100 last:border-0">
                      <td className="p-2"><span className="font-mono text-xs text-gray-400 mr-2">{code}</span>{label}</td>
                      {POSITIONS.map((p) => (
                        <td key={p} className="p-2 text-center">
                          <input type="checkbox" checked={(roleRights[p] ?? []).includes(code)}
                            onChange={() => toggleRoleRight(p, code)} />
                        </td>
                      ))}
                    </tr>
                  ))}
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
                        <button onClick={() => { const v = window.prompt(`Приход «${i.name}», ${i.unit}:`, '0'); const n = parseFloat((v ?? '').replace(',', '.')); if (n > 0) receiveStock(i.id, n) }}
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
                {editDish && <span className="ml-auto text-sm text-gray-400">Себест.: {formatTenge(dishCost(editDish, ingredients, techCardOverrides))} · доступно: {(() => { const m = dishMaxPortions(editDish, ingredients, techCardOverrides); return m === Infinity ? '∞' : m })()}</span>}
              </div>
              {!editDish ? <div className="text-gray-400 text-sm">Выберите блюдо для правки рецепта. Изменения сразу влияют на списание со склада на кассе.</div> : (() => {
                const card = techCardOverrides[editDish] ?? techCards[editDish] ?? []
                return (
                  <div>
                    {card.map((it, idx) => {
                      const ing = ingredients.find((x) => x.id === it.ingredientId)
                      return (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <select value={it.ingredientId} onChange={(e) => setTechCard(editDish, card.map((c, i) => i === idx ? { ...c, ingredientId: e.target.value } : c))}
                            className="h-9 rounded border border-gray-300 px-2 flex-1">
                            {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                          </select>
                          <input type="number" step="0.001" min={0} value={it.gross}
                            onChange={(e) => setTechCard(editDish, card.map((c, i) => i === idx ? { ...c, gross: Math.max(0, parseFloat(e.target.value) || 0) } : c))}
                            className="w-24 h-9 rounded border border-gray-300 px-2 text-right" />
                          <span className="text-gray-400 text-sm w-8">{ing?.unit}</span>
                          <button onClick={() => setTechCard(editDish, card.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500" title="Убрать">✕</button>
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
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {([['sales', 'Продажи за период'], ['stock', 'Остатки на складах'], ['olap', 'OLAP-отчёт'], ['pnl', 'Прибыли и убытки']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setReport(id)}
                  className={`px-4 h-10 text-sm -mb-px border-b-2 ${report === id ? 'border-emerald-500 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
              ))}
              <button onClick={exportTo1C} className="ml-auto h-8 self-center px-3 rounded bg-slate-700 text-white text-xs">Выгрузить в 1С (JSON)</button>
            </div>

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
                        <th className="p-2">Блюдо</th><th className="text-right">Кол-во</th><th className="text-right">Выручка</th><th className="text-right">Без НДС</th><th className="text-right">Себест.</th><th className="text-right">Валовая</th><th className="text-right p-2">Наценка %</th>
                      </tr></thead>
                      <tbody>
                        {salesByDish.length === 0 ? <tr><td colSpan={7} className="p-3 text-gray-400">Нет продаж.</td></tr> : salesByDish.map((d) => {
                          const gross = +(noVat(d.rev) - d.cost).toFixed(2)
                          const markup = d.cost > 0 ? Math.round(gross / d.cost * 100) : 0
                          return (
                            <tr key={d.name} className="border-b border-gray-100 last:border-0">
                              <td className="p-2">{d.name}</td>
                              <td className="text-right">{+d.qty.toFixed(2)}</td>
                              <td className="text-right">{formatTenge(d.rev)}</td>
                              <td className="text-right text-gray-500">{formatTenge(noVat(d.rev))}</td>
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

            {/* 3. OLAP-лайт */}
            {report === 'olap' && (
              <div>
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <label className="flex items-center gap-2">Измерение:
                    <select value={olapDim} onChange={(e) => setOlapDim(e.target.value as typeof olapDim)} className="h-8 rounded border border-gray-300 px-2">
                      <option value="dish">Блюдо</option><option value="day">День</option><option value="waiter">Официант</option><option value="payment">Тип оплаты</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">Показатель:
                    <select value={olapMeasure} onChange={(e) => setOlapMeasure(e.target.value as typeof olapMeasure)} className="h-8 rounded border border-gray-300 px-2">
                      <option value="revenue">Выручка</option><option value="checks">Чеки</option><option value="qty">Количество</option>
                    </select>
                  </label>
                </div>
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  {olapRows.length === 0 ? <div className="p-3 text-gray-400 text-sm">Нет данных.</div> : olapRows.map((r) => (
                    <div key={r.k} className="flex items-center gap-3 px-4 h-9 border-b border-gray-100 last:border-0">
                      <span className="w-44 truncate">{r.k}</span>
                      <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${Math.round(r.v / olapMax * 100)}%` }} /></div>
                      <span className="w-28 text-right tabular-nums">{olapFmt(r.v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. P&L */}
            {report === 'pnl' && (
              <div className="max-w-xl">
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  {[
                    ['Выручка (с ҚҚС)', revenue, false],
                    ['ҚҚС 16% (в т.ч.)', -vatKz, false],
                    ['Выручка без НДС', noVat(revenue), true],
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
              <OfficeStat label="ҚҚС 16% к уплате" value={formatTenge(vatKz)} />
              <OfficeStat label="Без НДС" value={formatTenge(+(revenue - vatKz).toFixed(2))} />
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
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Поставщик:</span>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-9 rounded border border-gray-300 px-2 flex-1">
                  <option value="">— выберите —</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name} (БИН {c.bin})</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <select value={pIng} onChange={(e) => setPIng(e.target.value)} className="h-9 rounded border border-gray-300 px-2 flex-1">
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
                <input value={pQty} onChange={(e) => setPQty(e.target.value)} inputMode="decimal" placeholder="кол-во" className="w-24 h-9 rounded border border-gray-300 px-2 text-right" />
                <input value={pPrice} onChange={(e) => setPPrice(e.target.value)} inputMode="decimal" placeholder="цена ₸" className="w-28 h-9 rounded border border-gray-300 px-2 text-right" />
                <button onClick={addPLine} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">+ строка</button>
              </div>
              {pLines.length > 0 && (
                <div className="border border-gray-100 rounded mb-3">
                  {pLines.map((l) => (
                    <div key={l.ingredientId} className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
                      <span className="flex-1">{l.name}</span><span className="text-gray-500">{l.qty} × {formatTenge(l.price)}</span><span className="w-24 text-right">{formatTenge(l.qty * l.price)}</span>
                      <button onClick={() => setPLines((ls) => ls.filter((x) => x.ingredientId !== l.ingredientId))} className="text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-1.5 text-sm font-semibold"><span>Итого (с ҚҚС)</span><span>{formatTenge(pLines.reduce((s, l) => s + l.qty * l.price, 0))}</span></div>
                </div>
              )}
              <button onClick={provesti} disabled={!supplierId || pLines.length === 0}
                className={`h-9 px-4 rounded text-sm ${supplierId && pLines.length ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Провести (приход + ЭСФ)</button>
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Входящие ЭСФ / приходные</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              {incoming.length === 0 ? <div className="p-3 text-gray-400 text-sm">Накладных пока нет.</div> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">№</th><th>Дата</th><th>Поставщик</th><th className="text-right">Сумма</th><th className="text-right">ҚҚС</th><th className="p-2">ЭСФ</th></tr></thead>
                  <tbody>
                    {incoming.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{inv.no}</td><td>{inv.date.split(',')[0]}</td><td>{inv.supplierName}</td>
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
        ) : (
          <div className="p-6 max-w-5xl">
            <div className="text-xs text-gray-500 mb-4">
              Платёжная ведомость (iikoOffice). 🇰🇿 Налоги РК 2026: удержания с работника — ОПВ 10%, ВОСМС 2%, ИПН 10% (вычет ОПВ+ВОСМС+30 МРП); за счёт работодателя — ОПВР 3,5%, ООСМС 3%, СО 5%, соцналог 6%.
              «К выплате» = оклад − удержания + премия − штрафы; выдача аванса/расчёта = <b>изъятие наличных из кассы</b> (отчёт 038).
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
                  <th className="p-2">Сотрудник</th><th className="text-right">Оклад ₸</th><th className="text-right">Налоги</th><th className="text-right">Премия</th><th className="text-right">Удержано</th><th className="text-right">К выплате</th>
                  <th className="text-right">Аванс</th><th className="text-right">Расчёт</th><th className="text-right">Остаток</th><th className="p-2 text-center">Действия</th>
                </tr></thead>
                <tbody>
                  {payrollRows.map(({ p, okl, opv, vosms, ipn, opvr, oosms, so, sn, premium, deduction, net, advance, settle, remaining }) => {
                    const advanceAmt = Math.min(remaining, Math.round(net * 0.4)) // аванс ≈ 40% от начисленного
                    return (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{p.name}<div className="text-xs text-gray-400">{p.positions[0]}</div></td>
                        <td className="text-right"><input type="number" value={okl} min={0} onChange={(e) => setSalary((s) => ({ ...s, [p.id]: Math.max(0, parseFloat(e.target.value) || 0) }))} className="w-24 h-8 rounded border border-gray-300 px-2 text-right" /></td>
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
                            <button onClick={() => { const a = parseFloat((window.prompt(`Удержание/штраф для ${p.name}, ₸:`, '') ?? '').replace(',', '.')); if (a > 0) { const r = window.prompt('Причина:', 'Штраф') ?? 'Штраф'; addDeduction(p.id, a, r) } }}
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
        )}
      </div>
    </div>
  )
}

const OfficeStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white border border-gray-200 rounded-md p-4">
    <div className="text-xs text-gray-400">{label}</div>
    <div className="text-xl font-bold text-gray-800">{value}</div>
  </div>
)
