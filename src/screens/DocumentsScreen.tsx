import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import TopBar from '../components/TopBar'
import { usePos } from '../store/pos'
import { warehouses } from '../mock/data'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import type { DocType, DocLine, StoreDoc } from '../types'

// «Документы» на кассе (iikoFront) — складские документы: акт списания/приготовления/переработки,
// внутреннее перемещение, расходная накладная, инвентаризация. Приходной накладной на терминале нет (офис).
const DOC_TYPES: DocType[] = ['Акт списания', 'Акт приготовления', 'Акт переработки', 'Внутреннее перемещение', 'Расходная накладная', 'Инвентаризация']

export default function DocumentsScreen() {
  const navigate = useNavigate()
  const { ingredients, documents, createStoreDoc, writeoffReasons } = usePos()
  const REASONS = writeoffReasons // причины списания из офиса (Розничные продажи)
  const [type, setType] = useState<DocType | null>(null)
  const [lines, setLines] = useState<DocLine[]>([])
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(writeoffReasons[0] ?? '')
  const [store, setStore] = useState(warehouses[0])
  const [toStore, setToStore] = useState(warehouses[1])
  const [resultId, setResultId] = useState(ingredients[0]?.id ?? '')
  const [resultQty, setResultQty] = useState('')
  const [viewDoc, setViewDoc] = useState<StoreDoc | null>(null) // открытый документ из истории

  const reset = () => { setType(null); setLines([]); setQty(''); setReason(REASONS[0]); setStore(warehouses[0]); setToStore(warehouses[1]); setResultQty('') }
  const isInv = type === 'Инвентаризация'
  const isWriteoff = type === 'Акт списания'
  const isTransfer = type === 'Внутреннее перемещение'
  const isMake = type === 'Акт приготовления' || type === 'Акт переработки'
  const isSale = type === 'Расходная накладная'

  const addLine = () => {
    const ing = ingredients.find((i) => i.id === ingId)
    const n = parseFloat(qty.replace(',', '.'))
    if (!ing || !(n > 0)) return
    // для инвентаризации фиксируем учётный остаток на момент добавления строки
    setLines((ls) => [...ls.filter((l) => l.ingredientId !== ing.id), { ingredientId: ing.id, name: ing.name, unit: ing.unit, qty: n, booked: isInv ? ing.stock : undefined }])
    setQty('')
  }
  const removeLine = (id: string) => setLines((ls) => ls.filter((l) => l.ingredientId !== id))

  const provesti = () => {
    if (!type || lines.length === 0) return
    if (isMake && !(parseFloat(resultQty.replace(',', '.')) > 0)) { alert('Укажите количество результата'); return }
    const resIng = ingredients.find((i) => i.id === resultId)
    const opts = {
      ...(isWriteoff ? { reason } : {}),
      ...(isTransfer || isSale ? { store } : {}),
      ...(isTransfer ? { toStore } : {}),
      ...(isMake && resIng ? { result: `${resIng.name} × ${resultQty} ${resIng.unit}` } : {}),
    }
    const doc = createStoreDoc(type, lines, opts)
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
                <thead className="text-white/50 text-left"><tr><th className="p-2">№</th><th>Тип</th><th>Склад</th><th>Дата</th><th>Кто</th><th className="text-right">Позиций</th></tr></thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} onClick={() => setViewDoc(d)}
                      className="border-b border-white/10 cursor-pointer hover:bg-white/5" title="Открыть документ">
                      <td className="p-2">{d.id}</td>
                      <td>{d.type}{d.reason ? ` · ${d.reason}` : ''}{d.result ? ` → ${d.result}` : ''}</td>
                      <td>{d.toStore ? `${d.store} → ${d.toStore}` : d.store}</td>
                      <td>{d.at}</td>
                      <td>{d.by}</td>
                      <td className="text-right">{d.lines.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {documents.length > 0 && <div className="text-white/40 text-xs mt-2">Нажмите документ, чтобы открыть и распечатать.</div>}
          </>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={reset} className="text-white/60 hover:text-white">‹ к типам</button>
              <div className="text-lg">{type}</div>
            </div>

            {/* склады: для перемещения — источник+получатель, для расходной — склад-источник */}
            {(isTransfer || isSale) && (
              <div className="flex items-end gap-3 mb-4">
                <label className="flex-1">
                  <div className="text-white/60 text-sm mb-1">{isTransfer ? 'Склад-источник' : 'Склад списания'}</div>
                  <select value={store} onChange={(e) => setStore(e.target.value)} className="w-full h-11 rounded-md px-2 bg-white text-gray-800">
                    {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
                {isTransfer && (
                  <label className="flex-1">
                    <div className="text-white/60 text-sm mb-1">Склад-получатель</div>
                    <select value={toStore} onChange={(e) => setToStore(e.target.value)} className="w-full h-11 rounded-md px-2 bg-white text-gray-800">
                      {warehouses.filter((w) => w !== store).map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}

            {/* результат приготовления/переработки */}
            {isMake && (
              <div className="flex items-end gap-3 mb-4 bg-white/5 rounded-lg p-3">
                <label className="flex-1">
                  <div className="text-white/60 text-sm mb-1">Результат (что приготовлено)</div>
                  <select value={resultId} onChange={(e) => setResultId(e.target.value)} className="w-full h-11 rounded-md px-2 bg-white text-gray-800">
                    {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                </label>
                <label className="w-36">
                  <div className="text-white/60 text-sm mb-1">Кол-во результата</div>
                  <input value={resultQty} onChange={(e) => setResultQty(e.target.value)} inputMode="decimal" placeholder="0"
                    className="w-full h-11 rounded-md px-3 bg-white text-gray-800" />
                </label>
              </div>
            )}

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
                <div className="text-white/60 text-sm mb-1">{isMake ? 'Списать ингредиент' : 'Товар'}</div>
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
              {isInv && lines.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 text-xs text-white/40 border-b border-white/10">
                  <span className="flex-1">Товар</span><span className="w-24 text-right">Учётный</span><span className="w-24 text-right">Факт</span><span className="w-24 text-right">Отклонение</span><span className="w-6" />
                </div>
              )}
              {lines.length === 0 ? <div className="p-3 text-white/40 text-sm">Добавьте позиции в документ.</div> : lines.map((l) => {
                const dev = isInv ? +(l.qty - (l.booked ?? 0)).toFixed(3) : 0
                return (
                  <div key={l.ingredientId} className="flex items-center gap-3 px-3 py-2 border-b border-white/10">
                    <span className="flex-1">{l.name}</span>
                    {isInv ? (
                      <>
                        <span className="w-24 text-right text-white/50">{l.booked ?? 0} {l.unit}</span>
                        <span className="w-24 text-right">{l.qty} {l.unit}</span>
                        <span className={`w-24 text-right ${dev === 0 ? 'text-white/40' : dev < 0 ? 'text-pos-rose' : 'text-pos-green'}`}>{dev > 0 ? '+' : ''}{dev} {l.unit}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-white/60">{l.qty} {l.unit}</span>
                        <span className="text-white/40 w-28 text-right">{formatTenge(lineCost(l))}</span>
                      </>
                    )}
                    <button onClick={() => removeLine(l.ingredientId)} className="text-white/40 hover:text-pos-rose w-6">✕</button>
                  </div>
                )
              })}
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

      {viewDoc && (() => {
        const d = viewDoc
        const isInvDoc = d.type === 'Инвентаризация'
        const total = d.lines.reduce((s, l) => s + (ingredients.find((i) => i.id === l.ingredientId)?.costPerUnit ?? 0) * l.qty, 0)
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewDoc(null)}>
            <div className="bg-white text-gray-800 rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-3 border-b flex items-center">
                <div>
                  <div className="font-semibold">{d.type} №{d.id}</div>
                  <div className="text-xs text-gray-500">{d.at} · {d.by}</div>
                </div>
                <button onClick={() => setViewDoc(null)} className="ml-auto text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
              </div>
              <div className="px-5 py-3 text-sm space-y-1">
                <div><span className="text-gray-500">Склад: </span>{d.toStore ? `${d.store} → ${d.toStore}` : d.store}</div>
                {d.reason && <div><span className="text-gray-500">Причина: </span>{d.reason}</div>}
                {d.result && <div><span className="text-gray-500">Результат: </span>{d.result}</div>}
              </div>
              <div className="flex-1 overflow-auto px-5">
                <table className="w-full text-sm">
                  <thead className="text-gray-400 text-left border-b">
                    <tr>
                      <th className="py-1">Товар</th>
                      {isInvDoc ? <><th className="text-right py-1">Учётный</th><th className="text-right py-1">Факт</th><th className="text-right py-1">Откл.</th></>
                        : <><th className="text-right py-1">Кол-во</th><th className="text-right py-1">Себест.</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => {
                      const dev = +(l.qty - (l.booked ?? 0)).toFixed(3)
                      const cost = (ingredients.find((i) => i.id === l.ingredientId)?.costPerUnit ?? 0) * l.qty
                      return (
                        <tr key={l.ingredientId} className="border-b border-gray-100">
                          <td className="py-1">{l.name}</td>
                          {isInvDoc ? (
                            <>
                              <td className="text-right text-gray-500">{l.booked ?? 0} {l.unit}</td>
                              <td className="text-right">{l.qty} {l.unit}</td>
                              <td className={`text-right ${dev === 0 ? 'text-gray-400' : dev < 0 ? 'text-pos-rose' : 'text-pos-green'}`}>{dev > 0 ? '+' : ''}{dev} {l.unit}</td>
                            </>
                          ) : (
                            <>
                              <td className="text-right">{l.qty} {l.unit}</td>
                              <td className="text-right text-gray-500">{formatTenge(cost)}</td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  {!isInvDoc && (
                    <tfoot><tr className="border-t font-semibold"><td className="py-1">Итого себестоимость</td><td /><td className="text-right">{formatTenge(total)}</td></tr></tfoot>
                  )}
                </table>
              </div>
              <div className="px-5 py-3 border-t flex gap-3 justify-end">
                <button onClick={() => setViewDoc(null)} className="h-11 px-5 rounded-md border border-gray-300 hover:bg-gray-100">Закрыть</button>
                <button onClick={() => printToast(`${d.type} №${d.id} распечатан · позиций: ${d.lines.length}`)}
                  className="h-11 px-6 rounded-md bg-pos-blue text-white">Печать</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
