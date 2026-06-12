import { useState } from 'react'
import { usePos } from '../store/pos'
import { cashInTypes, cashOutTypes } from '../mock/data'
import { formatTenge } from '../lib/money'
import NumPad from './NumPad'

interface Props { kind: 'in' | 'out'; onClose: () => void }

// Внесение / изъятие наличных. Учитывается в кассовой смене и отчётах.
export default function CashMovementModal({ kind, onClose }: Props) {
  const { addCashMovement } = usePos()
  const types = kind === 'in' ? cashInTypes : cashOutTypes
  const [type, setType] = useState(types[0])
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')

  const confirm = () => {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return
    addCashMovement(kind, type, amt, comment)
    onClose()
  }

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
      <div className="bg-white text-gray-800 rounded-lg p-5 w-[520px] flex gap-5">
        <div className="flex-1 flex flex-col gap-3">
          <div className="text-lg font-semibold">{kind === 'in' ? 'Внести деньги' : 'Изъять деньги'}</div>
          <label className="text-sm text-gray-500">Тип {kind === 'in' ? 'внесения' : 'изъятия'}</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-11 border border-gray-300 rounded-md px-2">
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <label className="text-sm text-gray-500">Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} className="h-11 border border-gray-300 rounded-md px-2" placeholder="необязательно" />
          <div className="mt-auto flex gap-2">
            <button onClick={onClose} className="flex-1 h-12 rounded-md bg-gray-200">Отмена</button>
            <button onClick={confirm} className="flex-1 h-12 rounded-md bg-pos-green text-white">
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
