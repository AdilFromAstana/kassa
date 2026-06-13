import { useState } from 'react'
import { usePos } from '../store/pos'
import { staff } from '../mock/data'
import { hasRight } from '../lib/rights'
import { formatTenge } from '../lib/money'

// Возврат оплаты (FRONT_03) — 1:1 с iikoFront: (опц. выбор позиций) → причина →
// режим (со списанием на склад / без) → подтверждение правом (F_STRN / F_SWWOFF).
// Нет права у текущего юзера → прокатка карты менеджера. Частичный возврат — через lines.
const REASONS = ['Ошибка официанта', 'Отказ гостя', 'Брак / качество', 'Ошибка кассира', 'Прочее']

type RefundLine = { uid: string; name: string; qty: number; total: number }

export default function RefundModal({
  title,
  amount,
  lines,
  onConfirm,
  onCancel,
}: {
  title: string
  amount?: number // фиксированная сумма (когда позиции выбраны снаружи)
  lines?: RefundLine[] // если заданы — модалка сама даёт выбрать позиции (частичный возврат)
  onConfirm: (opts: { reason: string; restock: boolean; by: string; uids?: string[] | 'all' }) => void
  onCancel: () => void
}) {
  const user = usePos((s) => s.user)
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(false)
  const [manager, setManager] = useState('') // карта менеджера, если у текущего юзера нет права
  const [picked, setPicked] = useState<Record<string, boolean>>(
    () => Object.fromEntries((lines ?? []).map((l) => [l.uid, true])))

  const need = restock ? 'F_STRN' : 'F_SWWOFF'
  const selfOk = hasRight(user?.positions, need)
  const managers = staff.filter((s) => hasRight(s.positions, need))
  const by = selfOk ? (user?.name ?? '') : manager

  const pickedUids = (lines ?? []).filter((l) => picked[l.uid]).map((l) => l.uid)
  const sum = lines ? lines.filter((l) => picked[l.uid]).reduce((s, l) => s + l.total, 0) : (amount ?? 0)
  const ready = reason !== '' && by !== '' && (!lines || pickedUids.length > 0)

  const confirm = () => onConfirm({
    reason, restock, by,
    uids: lines ? (pickedUids.length === lines.length ? 'all' : pickedUids) : undefined,
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#4a4f52] text-white rounded-xl shadow-2xl w-[540px] max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 text-xl border-b border-white/10">{title} · {formatTenge(sum)}</div>

        <div className="p-6 space-y-5">
          {/* выбор позиций — частичный возврат */}
          {lines && (
            <div>
              <div className="text-white/60 text-sm mb-2">Позиции к возврату</div>
              <div className="bg-white/5 rounded-lg overflow-hidden">
                {lines.map((l) => (
                  <label key={l.uid} className="flex items-center gap-3 px-3 py-2 border-b border-white/10 cursor-pointer">
                    <input type="checkbox" checked={!!picked[l.uid]} onChange={(e) => setPicked((p) => ({ ...p, [l.uid]: e.target.checked }))} />
                    <span className="flex-1">{l.name} ×{l.qty}</span>
                    <span>{formatTenge(l.total)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* причина */}
          <div>
            <div className="text-white/60 text-sm mb-2">Причина возврата</div>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={`h-11 px-3 rounded text-sm ${reason === r ? 'bg-pos-accent text-gray-900' : 'bg-white/10 hover:bg-white/20'}`}>{r}</button>
              ))}
            </div>
          </div>

          {/* режим */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={restock} onChange={(e) => { setRestock(e.target.checked); setManager('') }} />
            <span>Вернуть товар на склад
              <span className="text-white/40 text-sm"> ({restock ? 'со списанием на склад · F_STRN' : 'без списания · F_SWWOFF'})</span>
            </span>
          </label>

          {/* авторизация по праву */}
          <div>
            <div className="text-white/60 text-sm mb-2">Подтверждение права ({need})</div>
            {selfOk ? (
              <div className="text-pos-green text-sm">✓ Авторизовано: {user?.name} — право есть</div>
            ) : (
              <div>
                <div className="text-pos-rose text-sm mb-2">У вас нет права — проведите карту менеджера:</div>
                <div className="flex flex-wrap gap-2">
                  {managers.map((m) => (
                    <button key={m.id} onClick={() => setManager(m.name)}
                      className={`h-10 px-3 rounded text-sm ${manager === m.name ? 'bg-pos-accent text-gray-900' : 'bg-white/10 hover:bg-white/20'}`}>{m.name}</button>
                  ))}
                  {managers.length === 0 && <span className="text-white/40 text-sm">Нет сотрудников с правом {need}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#23262a] flex items-center justify-end gap-6 px-6 py-4">
          <button onClick={onCancel} className="text-white/80 px-4">Отмена</button>
          <button disabled={!ready} onClick={confirm}
            className={`px-6 py-2 rounded-md font-semibold ${ready ? 'bg-pos-rose text-gray-900' : 'bg-gray-600 text-white/40 cursor-not-allowed'}`}>
            Вернуть оплату
          </button>
        </div>
      </div>
    </div>
  )
}
