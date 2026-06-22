import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react'
import BackButton from '../components/BackButton'
import { usePos } from '../store/pos'
import { dishes } from '../mock/menu'
import { warehouses } from '../mock/data'
import { techCards, dishCost, dishMaxPortions, itemNetto, itemYield, dishYield, modifierTechCards, modifierCost } from '../mock/warehouse'
import { modifierGroups } from '../mock/menu'
import { formatTenge } from '../lib/money'
import { lowStock } from '../lib/stockAlerts'
import { stockAt } from '../lib/storeStock'

// «Товары и склады» (iikoOperation, упрощённо): остатки товаров-ингредиентов + техкарты блюд.
// Остаток списывается по техкарте (брутто) при оплате заказа на кассе. См. iiko_spec/04_tovary_i_sklady.md.
type Tab = 'stock' | 'tech'
const DEFAULT_STORE = warehouses[0] // «Основной склад»

export default function WarehouseScreen() {
  const navigate = useNavigate()
  const { ingredients, storeStock, resetStock } = usePos()
  const [tab, setTab] = useState<Tab>('stock')
  const [store, setStore] = useState<string>('all') // 'all' = все склады («Склад ▾», topic-604)
  const [openDish, setOpenDish] = useState<string | null>(null)

  const storeOf = (s?: string) => s ?? DEFAULT_STORE
  // остаток: «Все склады» → итог (i.stock); конкретный склад → из storeStock
  const qtyOf = (i: typeof ingredients[number]) => (store === 'all' ? i.stock : stockAt(storeStock, i.id, store))
  const shown = store === 'all' ? ingredients : ingredients.filter((i) => storeStock[i.id]?.[store] != null)
  const alerts = lowStock(ingredients) // тревоги по ИТОГАМ (тот же селектор, что в TopBar/боте)

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <div className="h-14 bg-white text-gray-800 flex items-center px-4 shrink-0">
        <div className="font-semibold">Товары и склады</div>
        <div className="ml-auto flex gap-1 text-sm">
          {([['stock', 'Остатки на складах'], ['tech', 'Технологические карты']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 h-9 rounded-md ${tab === k ? 'bg-pos-blue text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'stock' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center gap-3 mb-3 text-sm">
            <span className="text-white/60">Склад:</span>
            <select value={store} onChange={(e) => setStore(e.target.value)}
              className="h-9 rounded-md bg-pos-card border border-white/15 px-2 text-white">
              <option value="all">Все склады</option>
              {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            {alerts.count > 0 && (
              <span className="flex items-center gap-1 text-pos-rose"><AlertTriangle size={15} />Ниже минимума: {alerts.count}{alerts.out.length > 0 && ` (закончилось: ${alerts.out.length})`}</span>
            )}
            <button onClick={resetStock} className="ml-auto flex items-center gap-1 text-white/60 hover:text-white">
              <RotateCcw size={14} />Сбросить остатки
            </button>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-white/50 text-left border-b border-white/10">
                <th className="py-2 px-2">Артикул</th>
                <th className="py-2 px-2">Наименование</th>
                {store === 'all' && <th className="py-2 px-2">Склад</th>}
                <th className="py-2 px-2">Ед.</th>
                <th className="py-2 px-2 text-right">Себест. за ед.</th>
                <th className="py-2 px-2 text-right">Остаток</th>
                <th className="py-2 px-2 text-right">Мин.</th>
                <th className="py-2 px-2 text-right">Стоимость остатка</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const q = qtyOf(i)
                const neg = q < 0
                const low = !neg && q <= i.min
                return (
                  <tr key={i.id} className="border-b border-white/5">
                    <td className="py-1.5 px-2 text-white/50">{i.code}</td>
                    <td className="py-1.5 px-2">{i.name}</td>
                    {store === 'all' && <td className="py-1.5 px-2 text-white/50">{storeOf(i.store)}</td>}
                    <td className="py-1.5 px-2 text-white/60">{i.unit}</td>
                    <td className="py-1.5 px-2 text-right text-white/70">{formatTenge(i.costPerUnit)}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${neg ? 'text-pos-rose' : low ? 'text-amber-400' : ''}`}>
                      {fmt(q)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-white/40">{fmt(i.min)}</td>
                    <td className="py-1.5 px-2 text-right text-white/70">{formatTenge(Math.max(0, q) * i.costPerUnit)}</td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={store === 'all' ? 8 : 7} className="py-6 text-center text-white/40">Нет позиций на складе «{store}»</td></tr>
              )}
            </tbody>
          </table>
          <div className="text-white/40 text-xs mt-3">
            Просмотр остатков. Складские операции (списание, инвентаризация, перемещение, приготовление) — в разделе «Документы».
            При оплате заказа ингредиенты списываются по техкарте (брутто). Красный — отрицательный остаток, оранжевый — ниже минимума.
          </div>
        </div>
      )}

      {tab === 'tech' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="text-white/50 text-xs mb-3">
            Себестоимость «*» и списание считаются по <b>брутто</b> (норма закладки). Нетто = брутто − потери при холодной обработке;
            выход = нетто − потери при горячей обработке. «Выход блюда» — суммарная масса готового продукта (кг/л) на порцию.
            Нажмите блюдо, чтобы раскрыть техкарту. Блюда без техкарты (услуги) склад не списывают.
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-white/50 text-left border-b border-white/10">
                <th className="py-2 px-2 w-6"></th>
                <th className="py-2 px-2">Артикул</th>
                <th className="py-2 px-2">Блюдо</th>
                <th className="py-2 px-2 text-right">Цена</th>
                <th className="py-2 px-2 text-right">Себест.</th>
                <th className="py-2 px-2 text-right">Себест. %</th>
                <th className="py-2 px-2 text-right">Выход блюда</th>
                <th className="py-2 px-2 text-right">Доступно порций</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d) => {
                const card = techCards[d.id]
                const cost = dishCost(d.id, ingredients)
                const max = dishMaxPortions(d.id, ingredients)
                const pct = card && d.price ? (cost / d.price) * 100 : null
                const yld = dishYield(d.id, ingredients)
                const open = openDish === d.id
                return (
                  <FragmentRow key={d.id}>
                    <tr className={`border-b border-white/5 ${card ? 'cursor-pointer hover:bg-white/5' : ''}`}
                      onClick={() => card && setOpenDish(open ? null : d.id)}>
                      <td className="py-1.5 px-2 text-white/40">{card ? (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : null}</td>
                      <td className="py-1.5 px-2 text-white/50">{d.code}</td>
                      <td className="py-1.5 px-2">{d.name}</td>
                      <td className="py-1.5 px-2 text-right text-white/70">{formatTenge(d.price)}</td>
                      <td className="py-1.5 px-2 text-right">{card ? <>{formatTenge(cost)}<span className="text-pos-accent">*</span></> : <span className="text-white/30">—</span>}</td>
                      <td className="py-1.5 px-2 text-right text-white/60">{pct != null ? pct.toFixed(1) + '%' : '—'}</td>
                      <td className="py-1.5 px-2 text-right text-white/60">{card && yld > 0 ? fmt(yld) : '—'}</td>
                      <td className={`py-1.5 px-2 text-right font-medium ${max === 0 ? 'text-pos-rose' : ''}`}>
                        {max === Infinity ? '∞' : max}
                      </td>
                    </tr>
                    {open && card && (
                      <tr className="border-b border-white/10 bg-white/[0.03]">
                        <td></td>
                        <td colSpan={7} className="py-2 px-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-white/40 text-left">
                                <th className="py-1 pr-3">№</th>
                                <th className="py-1 pr-3">Наименование продукта</th>
                                <th className="py-1 pr-3">Ед.</th>
                                <th className="py-1 pr-3 text-right">Брутто</th>
                                <th className="py-1 pr-3 text-right">Потери хол. %</th>
                                <th className="py-1 pr-3 text-right">Нетто</th>
                                <th className="py-1 pr-3 text-right">Потери гор. %</th>
                                <th className="py-1 pr-3 text-right">Выход</th>
                                <th className="py-1 pr-3 text-right">Себест.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {card.map((it, idx) => {
                                const ing = ingredients.find((x) => x.id === it.ingredientId)
                                const lineCost = +(it.gross * (ing?.costPerUnit ?? 0)).toFixed(2)
                                return (
                                  <tr key={idx} className="text-white/70">
                                    <td className="py-1 pr-3 text-white/40">{idx + 1}</td>
                                    <td className="py-1 pr-3">{ing?.name ?? it.ingredientId}</td>
                                    <td className="py-1 pr-3 text-white/50">{ing?.unit}</td>
                                    <td className="py-1 pr-3 text-right">{fmt(it.gross)}</td>
                                    <td className="py-1 pr-3 text-right text-white/50">{it.coldLossPct ? fmt(it.coldLossPct) : '—'}</td>
                                    <td className="py-1 pr-3 text-right">{fmt(itemNetto(it))}</td>
                                    <td className="py-1 pr-3 text-right text-white/50">{it.hotLossPct ? fmt(it.hotLossPct) : '—'}</td>
                                    <td className="py-1 pr-3 text-right">{fmt(itemYield(it))}</td>
                                    <td className="py-1 pr-3 text-right text-white/60">{formatTenge(lineCost)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="text-white/60 border-t border-white/10">
                                <td colSpan={7} className="py-1 pr-3 text-right">Выход блюда (кг/л) / себестоимость:</td>
                                <td className="py-1 pr-3 text-right font-medium">{yld > 0 ? fmt(yld) : '—'}</td>
                                <td className="py-1 pr-3 text-right font-medium">{formatTenge(cost)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                )
              })}
            </tbody>
          </table>

          {/* Опен-меню: доп-ингредиенты модификаторов (списываются со склада + входят в себес блюда) */}
          {(() => {
            const rows = modifierGroups.flatMap((g) => g.options
              .filter((o) => (modifierTechCards[o.id]?.length ?? 0) > 0)
              .map((o) => ({ group: g.name, name: o.name, card: modifierTechCards[o.id], cost: modifierCost(o.id, ingredients) })))
            if (rows.length === 0) return null
            return (
              <div className="mt-6">
                <div className="text-white/50 text-xs uppercase mb-2">Доп-ингредиенты модификаторов (опен-меню)</div>
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="text-white/50 text-left border-b border-white/10">
                    <th className="py-2 px-2">Группа</th><th className="py-2 px-2">Модификатор</th><th className="py-2 px-2">Расход</th><th className="py-2 px-2 text-right">Себест. за ед.</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white/50">{r.group}</td>
                        <td className="py-1.5 px-2">{r.name}</td>
                        <td className="py-1.5 px-2 text-white/60">{r.card.map((it) => `${ingredients.find((x) => x.id === it.ingredientId)?.name ?? it.ingredientId}: ${fmt(it.gross)}`).join(', ')}</td>
                        <td className="py-1.5 px-2 text-right">{formatTenge(r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-white/40 text-xs mt-2">Отрицательный расход = замена (снимается базовый ингредиент). При продаже доп-ингредиенты списываются со склада и поднимают себестоимость заказа.</div>
              </div>
            )
          })()}
        </div>
      )}

      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}

// helper, чтобы вернуть две <tr> из map без обёртки-DOM
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const fmt = (n: number) => String(n).replace('.', ',')
