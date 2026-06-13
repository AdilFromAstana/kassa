import { useState } from 'react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import NumPad from './NumPad'

interface Props { onConfirm: (openingCash: number) => void; onCancel: () => void }

// Открытие кассовой смены (iikoFront): сначала Z-отчёт предыдущей смены (если была),
// затем ввод начального остатка наличных (разменный фонд) в денежном ящике.
export default function OpenShiftModal({ onConfirm, onCancel }: Props) {
  const { closedShifts, cashShiftSeq } = usePos()
  const prev = closedShifts[0] // последняя закрытая смена → её Z-отчёт
  const [amount, setAmount] = useState('')

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
      <div className="bg-white text-gray-800 rounded-lg p-5 w-[640px] flex gap-5">
        <div className="flex-1 flex flex-col gap-3">
          <div className="text-lg font-semibold">Открытие кассовой смены №{cashShiftSeq}</div>

          {/* Z-отчёт предыдущей смены */}
          {prev ? (
            <div className="bg-gray-100 rounded-md p-3 text-sm">
              <div className="font-semibold mb-1">Z-отчёт предыдущей смены №{prev.no}</div>
              <div className="flex justify-between text-gray-600"><span>Закрыта:</span><span>{prev.closedAt}</span></div>
              <div className="flex justify-between text-gray-600"><span>Чеков:</span><span>{prev.orders.length}</span></div>
              <div className="flex justify-between"><span>Выручка:</span><b>{formatTenge(prev.revenue)}</b></div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-md p-3 text-sm text-gray-500">Предыдущих закрытых смен нет — это первая смена.</div>
          )}

          <label className="text-sm text-gray-500 mt-1">Начальный остаток наличных (разменный фонд)</label>
          <div className="text-xs text-gray-400">Сумма наличных в денежном ящике на момент открытия смены.</div>

          <div className="mt-auto flex gap-2 pt-2">
            <button onClick={onCancel} className="flex-1 h-12 rounded-md bg-gray-200">Отмена</button>
            <button onClick={() => onConfirm(parseFloat(amount) || 0)} className="flex-1 h-12 rounded-md bg-pos-green text-white">
              Открыть смену
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-2xl font-bold h-9">{amount ? formatTenge(parseFloat(amount)) : '0 ₸'}</div>
          <NumPad onKey={(d) => setAmount((a) => a + d)} onBackspace={() => setAmount((a) => a.slice(0, -1))} onClear={() => setAmount('')} />
          <div className="flex gap-2">
            {[10000, 20000, 50000].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="h-9 px-3 rounded bg-gray-100 text-sm">{formatTenge(v)}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
