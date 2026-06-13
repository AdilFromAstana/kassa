import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import TopBar from '../components/TopBar'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import type { DocType, DocLine } from '../types'

// «Документы» на кассе (iikoFront) — складские документы: акт списания/приготовления/переработки,
// внутреннее перемещение, расходная накладная, инвентаризация. Приходной накладной на терминале нет (офис).
const DOC_TYPES: DocType[] = ['Акт списания', 'Акт приготовления', 'Акт переработки', 'Внутреннее перемещение', 'Расходная накладная', 'Инвентаризация']
const REASONS = ['Бой / порча', 'Просрочка', 'Проработка', 'Дегустация', 'Прочее']

export default function DocumentsScreen() {
  const navigate = useNavigate()
  const { ingredients, documents, createStoreDoc } = usePos()
  const [type, setType] = useState<DocType | null>(null)
  const [lines, setLines] = useState<DocLine[]>([])
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(REASONS[0])

  const reset = () => { setType(null); setLines([]); setQty(''); setReason(REASONS[0]) }
  const isInv = type === 'Инвентаризация'
  const isWriteoff = type === 'Акт списания'

  const addLine = () => {
    const ing = ingredients.find((i) => i.id === ingId)
    const n = parseFloat(qty.replace(',', '.'))
    if (!ing || !(n > 0)) return
    setLines((ls) => [...ls.filter((l) => l.ingredientId !== ing.id), { ingredientId: ing.id, name: ing.name, unit: ing.unit, qty: n }])
    setQty('')
  }
  const removeLine = (id: string) => setLines((ls) => ls.filter((l) => l.ingredientId !== id))

  const provesti = () => {
    if (!type || lines.length === 0) return
    const doc = createStoreDoc(type, lines, isWriteoff ? { reason } : undefined)
    printToast(`${type} №${doc.id} проведён · позиций: ${lines.length}`)
    reset()
  }

  const lineCost = (l: DocLine) => (ingredients.find((i) => i.id === l.ingredientId)?.costPerUnit ?? 0) * l.qty

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Документы" />
      <div className="flex-1 overflow-auto p-6">
        {!type ? (
          <>
            <div className="text-pos-accent text-sm uppercase mb-2">Создать документ</div>
            <div className="grid grid-cols-3 gap-3 max-w-3xl mb-8">
              {DOC_TYPES.map((t) => (
                <button key={t} onClick={() => { setType(t); setLines([]) }}
                  className="h-20 rounded-lg bg-white/5 hover:bg-white/10 px-4 text-left">{t}</button>
              ))}
            </div>

            <div className="text-pos-accent text-sm uppercase mb-2">История документов</div>
            {documents.length === 0 ? <div className="text-white/40 text-sm">Документов ещё нет.</div> : (
              <table className="w-full text-sm max-w-3xl">
                <thead className="text-white/50 text-left"><tr><th className="p-2">№</th><th>Тип</th><th>Дата</th><th>Кто</th><th className="text-right">Позиций</th></tr></thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} className="border-b border-white/10">
                      <td className="p-2">{d.id}</td>
                      <td>{d.type}{d.reason ? ` · ${d.reason}` : ''}</td>
                      <td>{d.at}</td>
                      <td>{d.by}</td>
                      <td className="text-right">{d.lines.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={reset} className="text-white/60 hover:text-white">‹ к типам</button>
              <div className="text-lg">{type}</div>
              <div className="text-white/40 text-sm ml-auto">Склад: Основной</div>
            </div>

            {isWriteoff && (
              <div className="mb-4">
                <div className="text-white/60 text-sm mb-2">Причина списания</div>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button key={r} onClick={() => setReason(r)} className={`h-9 px-3 rounded text-sm ${reason === r ? 'bg-pos-accent text-gray-900' : 'bg-white/10 hover:bg-white/20'}`}>{r}</button>
                  ))}
                </div>
              </div>
            )}

            {/* добавление строки */}
            <div className="flex items-end gap-2 mb-3">
              <label className="flex-1">
                <div className="text-white/60 text-sm mb-1">Товар</div>
                <select value={ingId} onChange={(e) => setIngId(e.target.value)} className="w-full h-11 rounded-md px-2 bg-white text-gray-800">
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit}, ост. {i.stock})</option>)}
                </select>
              </label>
              <label className="w-36">
                <div className="text-white/60 text-sm mb-1">{isInv ? 'Факт. остаток' : 'Количество'}</div>
                <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="0"
                  className="w-full h-11 rounded-md px-3 bg-white text-gray-800" />
              </label>
              <button onClick={addLine} className="h-11 px-4 rounded-md bg-pos-blue">Добавить</button>
            </div>

            {/* строки документа */}
            <div className="bg-white/5 rounded-lg overflow-hidden mb-4">
              {lines.length === 0 ? <div className="p-3 text-white/40 text-sm">Добавьте позиции в документ.</div> : lines.map((l) => (
                <div key={l.ingredientId} className="flex items-center gap-3 px-3 py-2 border-b border-white/10">
                  <span className="flex-1">{l.name}</span>
                  <span className="text-white/60">{l.qty} {l.unit}</span>
                  {!isInv && <span className="text-white/40 w-28 text-right">{formatTenge(lineCost(l))}</span>}
                  <button onClick={() => removeLine(l.ingredientId)} className="text-white/40 hover:text-pos-rose">✕</button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={provesti} disabled={lines.length === 0}
                className={`h-11 px-6 rounded-md font-semibold ${lines.length ? 'bg-pos-green text-white' : 'bg-gray-600 text-white/40'}`}>Провести документ</button>
              <button onClick={reset} className="h-11 px-5 rounded-md bg-white/10">Отмена</button>
            </div>
          </div>
        )}
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
