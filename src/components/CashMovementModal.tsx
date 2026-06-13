import { useState } from 'react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import NumPad from './NumPad'

interface Props { kind: 'in' | 'out'; onClose: () => void }

// Внесение / изъятие наличных. Типы — из офиса (Розничные продажи → Типы внесений/изъятий).
// Учитывается в кассовой смене и отчётах.
export default function CashMovementModal({ kind, onClose }: Props) {
  const { addCashMovement, cashOpTypes } = usePos()
  const types = cashOpTypes.filter((c) => c.direction === kind && c.manual)
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const selected = types.find((t) => t.id === typeId)

  const amt = parseFloat(amount) || 0
  const overLimit = !!(selected?.limit && amt > selected.limit)
  const needComment = !!selected?.requireComment && !comment.trim()
  const canConfirm = amt > 0 && !!selected && !overLimit && !needComment

  const confirm = () => {
    if (!canConfirm || !selected) return
    addCashMovement(kind, selected.name, amt, comment)
    onClose()
  }

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
      <div className="bg-white text-gray-800 rounded-lg p-5 w-[520px] flex gap-5">
        <div className="flex-1 flex flex-col gap-3">
          <div className="text-lg font-semibold">{kind === 'in' ? 'Внести деньги' : 'Изъять деньги'}</div>
          <label className="text-sm text-gray-500">Тип {kind === 'in' ? 'внесения' : 'изъятия'}</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="h-11 border border-gray-300 rounded-md px-2">
            {types.length === 0 && <option value="">— нет типов (настройте в офисе) —</option>}
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="text-sm text-gray-500">Комментарий{selected?.requireComment ? ' (обязательно)' : ''}</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} className="h-11 border border-gray-300 rounded-md px-2" placeholder={selected?.requireComment ? 'укажите причину' : 'необязательно'} />
          {overLimit && <div className="text-pos-rose text-xs">Превышен лимит: {formatTenge(selected!.limit!)}</div>}
          <div className="mt-auto flex gap-2">
            <button onClick={onClose} className="flex-1 h-12 rounded-md bg-gray-200">Отмена</button>
            <button onClick={confirm} disabled={!canConfirm} className={`flex-1 h-12 rounded-md text-white ${canConfirm ? 'bg-pos-green' : 'bg-gray-300'}`}>
              {kind === 'in' ? 'Внести' : 'Изъять'}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-2xl font-bold h-9">{amount ? formatTenge(parseFloat(amount)) : '0 ₸'}</div>
          <NumPad onKey={(d) => setAmount((a) => a + d)} onBackspace={() => setAmount((a) => a.slice(0, -1))} onClear={() => setAmount('')} />
        </div>
      </div>
    </div>
  )
}
