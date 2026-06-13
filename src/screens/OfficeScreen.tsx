import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Monitor } from 'lucide-react'
import { usePos } from '../store/pos'
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

type Section = 'settings' | 'menu' | 'staff' | 'stock'
const NAV: { id: Section | null; label: string }[] = [
  { id: 'settings', label: 'Настройки заведения' },
  { id: 'menu', label: 'Меню и цены' },
  { id: 'staff', label: 'Сотрудники и права' },
  { id: 'stock', label: 'Номенклатура и техкарты' },
  { id: null, label: 'Отчёты' },
]

export default function OfficeScreen() {
  const navigate = useNavigate()
  const { establishment: est, setEstablishment, priceOf, setDishPrice, roleRights, toggleRoleRight,
    ingredients, receiveStock, setIngredientStock } = usePos()
  const [section, setSection] = useState<Section>('settings')

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
        <nav className="flex-1 py-2">
          {NAV.map((n) => (
            <button key={n.label} disabled={!n.id} onClick={() => n.id && setSection(n.id)}
              className={`w-full text-left px-5 h-11 flex items-center text-sm ${
                n.id === section ? 'bg-white/10 border-l-2 border-emerald-400 font-medium'
                : n.id ? 'text-white/70 hover:bg-white/5' : 'text-white/40 cursor-default'}`}>
              {n.label}{!n.id && <span className="ml-auto text-[10px] text-white/30">скоро</span>}
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
          <div className="font-semibold">{section === 'settings' ? 'Настройки торгового предприятия' : section === 'menu' ? 'Меню и цены' : section === 'staff' ? 'Сотрудники и права' : 'Номенклатура и техкарты'}</div>
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
        ) : (
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

            <div className="text-gray-500 text-xs uppercase mb-2">Техкарты (только просмотр)</div>
            <div className="bg-white border border-gray-200 rounded-md overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                  <th className="p-2 font-medium">Блюдо</th><th className="p-2 font-medium text-right">Себест.</th><th className="p-2 font-medium text-right">Доступно</th><th className="p-2 font-medium">Состав (на порцию)</th>
                </tr></thead>
                <tbody>
                  {dishes.filter((d) => techCards[d.id]).map((d) => {
                    const m = dishMaxPortions(d.id, ingredients)
                    return (
                      <tr key={d.id} className="border-b border-gray-100 last:border-0 align-top">
                        <td className="p-2">{d.name}</td>
                        <td className="p-2 text-right">{formatTenge(dishCost(d.id, ingredients))}</td>
                        <td className="p-2 text-right">{m === Infinity ? '∞' : m}</td>
                        <td className="p-2 text-gray-500 text-xs">{techCards[d.id].map((it) => { const ing = ingredients.find((x) => x.id === it.ingredientId); return ing ? `${ing.name} ${it.gross} ${ing.unit}` : it.ingredientId }).join(' · ')}</td>
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
