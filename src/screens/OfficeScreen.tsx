import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Monitor } from 'lucide-react'
import { usePos, lineTotal } from '../store/pos'
import { printToast } from '../lib/print'
import { menuGroups, dishesByGroup, dishes } from '../mock/menu'
import { techCards, dishCost, dishMaxPortions } from '../mock/warehouse'
import { staff } from '../mock/data'
import { RIGHTS, POSITIONS } from '../lib/rights'
import { formatTenge } from '../lib/money'
import type { Establishment } from '../types'

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

type Section = 'settings' | 'menu' | 'staff' | 'stock' | 'reports' | 'accounting' | 'payroll'
const NAV: { id: Section; label: string }[] = [
  { id: 'settings', label: 'Настройки заведения' },
  { id: 'menu', label: 'Меню и цены' },
  { id: 'staff', label: 'Сотрудники и права' },
  { id: 'stock', label: 'Номенклатура и техкарты' },
  { id: 'accounting', label: 'Бухгалтерия (KZ)' },
  { id: 'payroll', label: 'Зарплата (KZ)' },
  { id: 'reports', label: 'Отчёты' },
]

// Роли офиса (как в iikoOffice) → доступные разделы. Гейтит сайдбар.
const OFFICE_ROLES = ['Администратор', 'Управляющий', 'Бухгалтер']
const ROLE_SECTIONS: Record<string, Section[]> = {
  'Администратор': ['settings', 'menu', 'staff', 'stock', 'accounting', 'payroll', 'reports'],
  'Управляющий': ['settings', 'menu', 'stock', 'accounting', 'payroll', 'reports'],
  'Бухгалтер': ['accounting', 'payroll', 'reports', 'stock'],
}

export default function OfficeScreen() {
  const navigate = useNavigate()
  const { establishment: est, setEstablishment, priceOf, setDishPrice, roleRights, toggleRoleRight,
    ingredients, receiveStock, setIngredientStock, closedOrders, refunds, documents,
    techCardOverrides, setTechCard, contractors, invoices, addContractor, addPurchase, addOutEsf } = usePos()
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
  const byType: Record<string, number> = {}
  for (const o of closedOrders) for (const p of o.payments) byType[p.name] = (byType[p.name] ?? 0) + p.amount
  const dishAgg: Record<string, { qty: number; sum: number }> = {}
  for (const o of closedOrders) for (const l of o.lines) { (dishAgg[l.name] ??= { qty: 0, sum: 0 }); dishAgg[l.name].qty += l.qty; dishAgg[l.name].sum += lineTotal(l) }
  const topDishes = Object.entries(dishAgg).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sum - a.sum).slice(0, 5)

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
          <div className="font-semibold">{section === 'settings' ? 'Настройки торгового предприятия' : section === 'menu' ? 'Меню и цены' : section === 'staff' ? 'Сотрудники и права' : section === 'stock' ? 'Номенклатура и техкарты' : section === 'accounting' ? 'Бухгалтерия (KZ)' : section === 'payroll' ? 'Зарплата (KZ)' : 'Отчёты'}</div>
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
        ) : section === 'staff' ? (
          <div className="p-6 max-w-4xl">
            <div className="text-xs text-gray-500 mb-5">
              Роли и права (как в iikoOffice). Галочки задают, что разрешено должности; касса применяет сразу
              (стоп-лист, возврат, смена, деньги, скидки, отчёты, явки и т.д.).
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Сотрудники</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
              {staff.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 h-12 border-b border-gray-100 last:border-0">
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-gray-400">PIN {s.pin}</span>
                  <span className="text-sm text-gray-600">{s.positions.join(', ')}</span>
                </div>
              ))}
            </div>

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
          <div className="p-6 max-w-3xl">
            <div className="text-xs text-gray-500 mb-5">
              Сводка по текущей смене (из закрытых чеков кассы). В реальном iikoOffice — OLAP-отчёты; здесь базовая сводка.
            </div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <OfficeStat label="Выручка" value={formatTenge(revenue)} />
              <OfficeStat label="Чеков" value={String(closedOrders.length)} />
              <OfficeStat label="Средний чек" value={formatTenge(avg)} />
              <OfficeStat label="Возвраты" value={formatTenge(refSum)} />
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">По типам оплаты</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
              {Object.entries(byType).length === 0 ? <div className="p-3 text-gray-400 text-sm">Нет продаж.</div> :
                Object.entries(byType).map(([n, v]) => (
                  <div key={n} className="flex justify-between px-4 h-11 items-center border-b border-gray-100 last:border-0"><span>{n}</span><span>{formatTenge(v)}</span></div>
                ))}
            </div>

            <div className="text-gray-500 text-xs uppercase mb-2">Топ блюд</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              {topDishes.length === 0 ? <div className="p-3 text-gray-400 text-sm">Нет продаж.</div> :
                topDishes.map((t) => (
                  <div key={t.name} className="flex justify-between px-4 h-11 items-center border-b border-gray-100 last:border-0"><span>{t.name} ×{t.qty}</span><span>{formatTenge(t.sum)}</span></div>
                ))}
            </div>

            <div className="text-gray-400 text-xs mt-4 flex items-center gap-3">
              <span>Складских документов за сессию: {documents.length}</span>
              <button onClick={exportTo1C} className="h-8 px-3 rounded bg-slate-700 text-white text-xs">Выгрузить в 1С (JSON)</button>
            </div>
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
          <div className="p-6 max-w-3xl">
            <div className="text-xs text-gray-500 mb-5">
              Зарплата и налоги РК (упрощённо): ОПВ 10%, ВОСМС 2%, ИПН 10% (после ОПВ/ВОСМС), СО 3.5% (работодатель). Оклад редактируется.
            </div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2">Сотрудник</th><th>Должность</th><th className="text-right">Оклад ₸</th><th className="text-right">ОПВ</th><th className="text-right">ВОСМС</th><th className="text-right">ИПН</th><th className="text-right">На руки</th><th className="text-right p-2">СО (раб-ль)</th>
                </tr></thead>
                <tbody>
                  {staff.map((p) => {
                    const okl = salary[p.id] ?? 250000
                    const opv = Math.round(okl * 0.10), vosms = Math.round(okl * 0.02)
                    const ipn = Math.round((okl - opv - vosms) * 0.10)
                    const net = okl - opv - vosms - ipn, so = Math.round(okl * 0.035)
                    return (
                      <tr key={p.id} className="border-b border-gray-100 last:border-0">
                        <td className="p-2">{p.name}</td><td className="text-gray-500">{p.positions[0]}</td>
                        <td className="text-right"><input type="number" value={okl} min={0} onChange={(e) => setSalary((s) => ({ ...s, [p.id]: Math.max(0, parseFloat(e.target.value) || 0) }))} className="w-28 h-8 rounded border border-gray-300 px-2 text-right" /></td>
                        <td className="text-right text-gray-600">{formatTenge(opv)}</td>
                        <td className="text-right text-gray-600">{formatTenge(vosms)}</td>
                        <td className="text-right text-gray-600">{formatTenge(ipn)}</td>
                        <td className="text-right font-semibold">{formatTenge(net)}</td>
                        <td className="text-right p-2 text-gray-500">{formatTenge(so)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
