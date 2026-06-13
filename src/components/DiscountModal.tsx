import { useState } from 'react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import type { Discount } from '../types'

interface Props {
  subtotal: number          // сумма заказа (для проверки «не менее»)
  discountPct: number
  surchargePct: number
  discountAmount?: number    // текущая фикс-сумма скидки
  selLineName?: string       // имя выделенной позиции (для скидки на позицию)
  selLineDiscount?: number   // текущая скидка выделенной позиции, %
  onApplyDiscount: (pct: number) => void
  onApplySurcharge: (pct: number) => void
  onApplyDiscountAmount?: (amount: number) => void
  onApplyLineDiscount?: (pct: number) => void
  onClose: () => void
}

// текущее время в окне «счастливого часа»
const inWindow = (from?: string, to?: string) => {
  if (!from || !to) return true
  const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes()
  const [fh, fm] = from.split(':').map(Number); const [th, tm] = to.split(':').map(Number)
  return cur >= fh * 60 + fm && cur <= th * 60 + tm
}

// Скидки/надбавки на заказ (Дисконтная система офиса → касса). Право F_ID на ручное назначение.
// Клубная карта (topic-502): прокатка номера → скидка её типа (способ «по карте»).
export default function DiscountModal({ subtotal, discountPct, surchargePct, discountAmount, selLineName, selLineDiscount, onApplyDiscount, onApplySurcharge, onApplyDiscountAmount, onApplyLineDiscount, onClose }: Props) {
  const { discounts, clubCards, can } = usePos()
  const canManual = can('F_ID')
  const [card, setCard] = useState('')
  const [manual, setManual] = useState('')
  const [manualSum, setManualSum] = useState('')
  const [lineDisc, setLineDisc] = useState('')
  const [cardMsg, setCardMsg] = useState('')

  // применима ли скидка сейчас: ручная + право + период + порог суммы
  const applicable = (d: Discount) => d.manual && canManual && inWindow(d.fromTime, d.toTime) && (!d.minSum || subtotal >= d.minSum)
  const list = (kind: 'discount' | 'surcharge') => discounts.filter((d) => d.kind === kind)

  const apply = (d: Discount) => {
    if (d.kind === 'discount') onApplyDiscount(d.percent)
    else onApplySurcharge(d.percent)
    onClose()
  }

  const applyCard = () => {
    const c = clubCards.find((x) => x.number.replace(/\s/g, '') === card.replace(/\s/g, ''))
    if (!c) { setCardMsg('Карта не найдена'); return }
    const d = discounts.find((x) => x.id === c.discountId && x.byCard)
    if (!d) { setCardMsg('У карты нет действующей скидки'); return }
    onApplyDiscount(d.percent)
    onClose()
  }

  const Row = ({ d }: { d: Discount }) => {
    const ok = applicable(d)
    return (
      <button disabled={!ok} onClick={() => apply(d)}
        className={`w-full flex items-center justify-between px-3 h-12 rounded border text-left ${ok ? 'bg-white border-gray-200 hover:border-emerald-400 text-gray-800' : 'bg-gray-100 border-gray-100 text-gray-400'}`}>
        <span>
          {d.name}
          {d.fromTime && <span className="text-xs text-gray-400 ml-2">{d.fromTime}–{d.toTime}</span>}
          {d.minSum ? <span className="text-xs text-gray-400 ml-2">от {formatTenge(d.minSum)}</span> : null}
        </span>
        <span className="font-semibold">{d.percent}%</span>
      </button>
    )
  }

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={onClose}>
      <div className="bg-pos-panel text-gray-800 rounded-lg w-[680px] max-h-[90%] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <div className="text-lg font-semibold text-gray-900">Скидки и надбавки</div>
          <div className="ml-auto text-sm text-gray-500">Сумма заказа: {formatTenge(subtotal)} · сейчас: −{discountPct}% / +{surchargePct}%</div>
        </div>
        {!canManual && <div className="text-pos-rose text-sm mb-3 bg-rose-50 rounded p-2">Нет права на ручную скидку (F_ID). Доступна только клубная карта.</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 text-xs uppercase mb-2">Скидки</div>
            <div className="space-y-2">
              {list('discount').length === 0 ? <div className="text-gray-400 text-sm">Нет скидок.</div> : list('discount').map((d) => <Row key={d.id} d={d} />)}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase mb-2">Надбавки</div>
            <div className="space-y-2">
              {list('surcharge').length === 0 ? <div className="text-gray-400 text-sm">Нет надбавок.</div> : list('surcharge').map((d) => <Row key={d.id} d={d} />)}
            </div>
          </div>
        </div>

        {/* клубная карта */}
        <div className="mt-4 bg-white border border-gray-200 rounded p-3">
          <div className="text-gray-500 text-xs uppercase mb-2">Клубная карта</div>
          <div className="flex items-end gap-2">
            <input value={card} onChange={(e) => { setCard(e.target.value); setCardMsg('') }} placeholder="прокатать / ввести номер" className="h-9 rounded border border-gray-300 px-2 flex-1" />
            <button onClick={applyCard} className="h-9 px-4 rounded bg-pos-blue text-white text-sm">Применить карту</button>
          </div>
          {cardMsg && <div className="text-pos-rose text-xs mt-1">{cardMsg}</div>}
        </div>

        {/* ручная скидка на ЗАКАЗ: % или фикс-сумма ₸ */}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-gray-500">Своя скидка, %
            <input value={manual} onChange={(e) => setManual(e.target.value.replace(/[^\d.]/g, ''))} disabled={!canManual} placeholder="0" className="mt-1 h-9 w-24 rounded border border-gray-300 px-2 text-right disabled:bg-gray-100" />
          </label>
          <button disabled={!canManual} onClick={() => { onApplyDiscount(Math.min(100, parseFloat(manual) || 0)); onClose() }} className={`h-9 px-4 rounded text-sm ${canManual ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Применить %</button>
          {onApplyDiscountAmount && (
            <>
              <label className="flex flex-col text-xs text-gray-500 ml-2">Скидка суммой, ₸{discountAmount ? <span className="text-emerald-600"> (сейчас −{formatTenge(discountAmount)})</span> : null}
                <input value={manualSum} onChange={(e) => setManualSum(e.target.value.replace(/[^\d.]/g, ''))} disabled={!canManual} placeholder="0" className="mt-1 h-9 w-28 rounded border border-gray-300 px-2 text-right disabled:bg-gray-100" />
              </label>
              <button disabled={!canManual} onClick={() => { onApplyDiscountAmount(Math.max(0, parseFloat(manualSum) || 0)); onClose() }} className={`h-9 px-4 rounded text-sm ${canManual ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Применить ₸</button>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={() => { onApplyDiscount(0); onApplyDiscountAmount?.(0); onClose() }} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">Снять скидку</button>
            <button onClick={() => { onApplySurcharge(0); onClose() }} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">Снять надбавку</button>
          </div>
        </div>

        {/* скидка на ВЫДЕЛЕННУЮ ПОЗИЦИЮ */}
        {selLineName && onApplyLineDiscount && (
          <div className="mt-3 bg-white border border-gray-200 rounded p-3 flex flex-wrap items-end gap-2">
            <div className="text-gray-500 text-xs uppercase w-full mb-1">Скидка на позицию: {selLineName}{selLineDiscount ? ` (сейчас −${selLineDiscount}%)` : ''}</div>
            <input value={lineDisc} onChange={(e) => setLineDisc(e.target.value.replace(/[^\d.]/g, ''))} disabled={!canManual} placeholder="0" className="h-9 w-24 rounded border border-gray-300 px-2 text-right disabled:bg-gray-100" />
            <span className="text-gray-400 text-sm">%</span>
            <button disabled={!canManual} onClick={() => { onApplyLineDiscount(Math.min(100, parseFloat(lineDisc) || 0)); onClose() }} className={`h-9 px-4 rounded text-sm ${canManual ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Применить к позиции</button>
            <button onClick={() => { onApplyLineDiscount(0); onClose() }} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">Снять</button>
          </div>
        )}
      </div>
    </div>
  )
}
