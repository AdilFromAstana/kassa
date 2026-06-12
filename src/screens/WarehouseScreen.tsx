import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackagePlus, RotateCcw, AlertTriangle } from 'lucide-react'
import BackButton from '../components/BackButton'
import QuantityModal from '../components/QuantityModal'
import { usePos } from '../store/pos'
import { dishes } from '../mock/menu'
import { techCards, dishCost, dishMaxPortions } from '../mock/warehouse'
import { formatTenge } from '../lib/money'
import type { Ingredient } from '../types'

// «Товары и склады» (iikoOperation, упрощённо): остатки товаров-ингредиентов + техкарты блюд.
// Остаток списывается по техкарте при оплате заказа на кассе. См. iiko_spec/04_tovary_i_sklady.md.
type Tab = 'stock' | 'tech'

export default function WarehouseScreen() {
  const navigate = useNavigate()
  const { ingredients, receiveStock, setIngredientStock, resetStock } = usePos()
  const [tab, setTab] = useState<Tab>('stock')
  // модалка прихода/инвентаризации: { ing, mode }
  const [edit, setEdit] = useState<{ ing: Ingredient; mode: 'receive' | 'set' } | null>(null)

  const lowCount = ingredients.filter((i) => i.stock < i.min).length

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
            <span className="text-white/60">Склад: Основной</span>
            {lowCount > 0 && (
              <span className="flex items-center gap-1 text-pos-rose"><AlertTriangle size={15} />Ниже минимума: {lowCount}</span>
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
                <th className="py-2 px-2">Ед.</th>
                <th className="py-2 px-2 text-right">Себест. за ед.</th>
                <th className="py-2 px-2 text-right">Остаток</th>
                <th className="py-2 px-2 text-right">Мин.</th>
                <th className="py-2 px-2 text-right">Стоимость остатка</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((i) => {
                const neg = i.stock < 0
                const low = !neg && i.stock < i.min
                return (
                  <tr key={i.id} className="border-b border-white/5">
                    <td className="py-1.5 px-2 text-white/50">{i.code}</td>
                    <td className="py-1.5 px-2">{i.name}</td>
                    <td className="py-1.5 px-2 text-white/60">{i.unit}</td>
                    <td className="py-1.5 px-2 text-right text-white/70">{formatTenge(i.costPerUnit)}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${neg ? 'text-pos-rose' : low ? 'text-amber-400' : ''}`}>
                      {fmt(i.stock)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-white/40">{fmt(i.min)}</td>
                    <td className="py-1.5 px-2 text-right text-white/70">{formatTenge(Math.max(0, i.stock) * i.costPerUnit)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">
                      <button onClick={() => setEdit({ ing: i, mode: 'receive' })}
                        className="inline-flex items-center gap-1 text-pos-green hover:underline mr-3" title="Приходная накладная">
                        <PackagePlus size={15} />Приход
                      </button>
                      <button onClick={() => setEdit({ ing: i, mode: 'set' })}
                        className="text-white/50 hover:text-white" title="Инвентаризация — выставить факт">Факт</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="text-white/40 text-xs mt-3">
            «Приход» = приходная накладная (увеличивает остаток). «Факт» = инвентаризация (выставить фактический остаток).
            При оплате заказа на кассе ингредиенты списываются по техкарте. Красный — отрицательный остаток, оранжевый — ниже минимума.
          </div>
        </div>
      )}

      {tab === 'tech' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="text-white/50 text-xs mb-3">
            Себестоимость «*» рассчитана из техкарты (Σ брутто × себестоимость ингредиента). Метод списания — «Списывать ингредиенты».
            Блюда без техкарты (услуги) склад не списывают.
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-white/50 text-left border-b border-white/10">
                <th className="py-2 px-2">Артикул</th>
                <th className="py-2 px-2">Блюдо</th>
                <th className="py-2 px-2 text-right">Цена</th>
                <th className="py-2 px-2 text-right">Себест.</th>
                <th className="py-2 px-2 text-right">Себест. %</th>
                <th className="py-2 px-2 text-right">Доступно порций</th>
                <th className="py-2 px-2">Состав (на 1 порцию)</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d) => {
                const card = techCards[d.id]
                const cost = dishCost(d.id, ingredients)
                const max = dishMaxPortions(d.id, ingredients)
                const pct = card && d.price ? (cost / d.price) * 100 : null
                return (
                  <tr key={d.id} className="border-b border-white/5 align-top">
                    <td className="py-1.5 px-2 text-white/50">{d.code}</td>
                    <td className="py-1.5 px-2">{d.name}</td>
                    <td className="py-1.5 px-2 text-right text-white/70">{formatTenge(d.price)}</td>
                    <td className="py-1.5 px-2 text-right">{card ? <>{formatTenge(cost)}<span className="text-pos-accent">*</span></> : <span className="text-white/30">—</span>}</td>
                    <td className="py-1.5 px-2 text-right text-white/60">{pct != null ? pct.toFixed(1) + '%' : '—'}</td>
                    <td className={`py-1.5 px-2 text-right font-medium ${max === 0 ? 'text-pos-rose' : ''}`}>
                      {max === Infinity ? '∞' : max}
                    </td>
                    <td className="py-1.5 px-2 text-white/50 text-xs">
                      {card
                        ? card.map((it) => {
                            const ing = ingredients.find((x) => x.id === it.ingredientId)
                            return ing ? `${ing.name} ${fmt(it.gross)} ${ing.unit}` : it.ingredientId
                          }).join(' · ')
                        : 'без техкарты (услуга)'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>

      {edit && (
        <QuantityModal
          dishName={`${edit.mode === 'receive' ? 'Приход' : 'Инвентаризация (факт)'} · ${edit.ing.name}`}
          unit={edit.ing.unit.toUpperCase()}
          value={edit.mode === 'receive' ? 0 : edit.ing.stock}
          onOk={(n) => {
            if (edit.mode === 'receive') { if (n > 0) receiveStock(edit.ing.id, n) }
            else setIngredientStock(edit.ing.id, n)
            setEdit(null)
          }}
          onCancel={() => setEdit(null)}
        />
      )}
    </div>
  )
}

const fmt = (n: number) => String(n).replace('.', ',')
