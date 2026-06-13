import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineUnitPrice } from '../store/pos'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'
import RefundModal from '../components/RefundModal'
import type { ClosedOrder } from '../types'

type Sel = 'all' | { uid: string; qty: number }[]
const fmtQty = (n: number) => String(+n.toFixed(3)).replace('.', ',')

// Закрытые заказы + возвраты (дробный по количеству / полный) и изменение типа оплаты (FRONT_03 §2.6).
export default function ClosedOrdersScreen() {
  const navigate = useNavigate()
  const { closedOrders, refunds, refundOrder, changePaymentType, cashShift, paymentTypes, can } = usePos()
  const [selNo, setSelNo] = useState<string | null>(closedOrders[0]?.fiscalDocNo ?? null)
  const [pickedQty, setPickedQty] = useState<Record<string, number>>({})
  const [changing, setChanging] = useState(false)
  const [splitAmt, setSplitAmt] = useState<Record<string, string>>({}) // частичная смена типа оплаты: ptId → сумма
  const [q, setQ] = useState('') // поиск по № заказа / официанту
  const canChangePay = can('F_CHPAY')
  const visible = closedOrders.filter((o) => !q || String(o.id).includes(q.trim()) || o.waiter.toLowerCase().includes(q.trim().toLowerCase()))
  const [refundReq, setRefundReq] = useState<{ sel: Sel; amount: number; title: string } | null>(null)

  const order = closedOrders.find((o) => o.fiscalDocNo === selNo) ?? null
  const orderRefunds = order ? refunds.filter((r) => r.orderId === order.id) : []

  // сколько единиц позиции уже возвращено (блок повторного возврата). Учёт legacy-возвратов без qtyByUid.
  const returnedQty = (uid: string): number => orderRefunds.reduce((s, r) => {
    if (r.qtyByUid) return s + (r.qtyByUid[uid] ?? 0)
    if (r.lineUids.includes(uid)) return s + (order?.lines.find((l) => l.uid === uid)?.qty ?? 0)
    return s
  }, 0)
  const remainingOf = (uid: string, qty: number) => +(qty - returnedQty(uid)).toFixed(3)

  const pickedSum = order ? order.lines.reduce((s, l) => s + lineUnitPrice(l) * (pickedQty[l.uid] ?? 0), 0) : 0
  const pickedAny = Object.values(pickedQty).some((v) => v > 0)
  const anyReturned = !!order && order.lines.some((l) => returnedQty(l.uid) > 0)
  const fullyReturned = !!order && order.lines.every((l) => remainingOf(l.uid, l.qty) <= 0)

  const setQty = (uid: string, qty: number, max: number) =>
    setPickedQty((p) => ({ ...p, [uid]: Math.max(0, Math.min(+qty.toFixed(3), max)) }))

  const doPartial = () => {
    if (!order || !pickedAny) return
    const sel = order.lines.map((l) => ({ uid: l.uid, qty: pickedQty[l.uid] ?? 0 })).filter((s) => s.qty > 0)
    setRefundReq({ sel, amount: +pickedSum.toFixed(2), title: 'Возврат по количеству' })
  }
  const doFull = () => {
    if (!order || fullyReturned) return
    if (!anyReturned) { setRefundReq({ sel: 'all', amount: order.total, title: 'Полный возврат' }); return }
    // часть уже возвращена → возвращаем остаток по количеству
    const sel = order.lines.map((l) => ({ uid: l.uid, qty: remainingOf(l.uid, l.qty) })).filter((s) => s.qty > 0)
    const amount = +order.lines.reduce((s, l) => s + lineUnitPrice(l) * remainingOf(l.uid, l.qty), 0).toFixed(2)
    setRefundReq({ sel, amount, title: 'Возврат остатка' })
  }
  const confirmRefund = (opts: { reason: string; restock: boolean; by: string; method: 'cash' | 'card' }) => {
    if (!order || !refundReq) return
    const r = refundOrder(order.fiscalDocNo, refundReq.sel, opts)
    if (r) {
      printToast(`Возвратный чек №${r.fiscalDocNo} на ${formatTenge(r.amount)} (Webkassa)\nПричина: ${opts.reason}${opts.restock ? ' · на склад' : ''} · ${opts.by}`)
      setPickedQty({})
    }
    setRefundReq(null)
  }
  const openChange = () => {
    if (!order) return
    // префилл: текущая оплата заказа в редактор
    const pre: Record<string, string> = {}
    for (const p of order.payments) pre[p.paymentTypeId] = String(+(((pre[p.paymentTypeId] ? +pre[p.paymentTypeId] : 0) + p.amount)).toFixed(2))
    setSplitAmt(pre); setChanging(true)
  }
  const parseAmt = (s: string) => parseFloat((s || '0').replace(',', '.')) || 0
  const splitSum = order ? +Object.values(splitAmt).reduce((s, v) => s + parseAmt(v), 0).toFixed(2) : 0
  const splitDiff = order ? +(splitSum - order.total).toFixed(2) : 0
  const applyChange = () => {
    if (!order || Math.abs(splitDiff) > 0.01) return
    const payments = paymentTypes
      .filter((pt) => parseAmt(splitAmt[pt.id]) > 0)
      .map((pt) => ({ paymentTypeId: pt.id, name: pt.name, amount: parseAmt(splitAmt[pt.id]) }))
    if (payments.length === 0) return
    changePaymentType(order.fiscalDocNo, payments)
    printToast(`Тип оплаты изменён: ${payments.map((p) => `${p.name} ${formatTenge(p.amount)}`).join(', ')}`)
    setChanging(false); setSplitAmt({})
  }

  const selectOrder = (o: ClosedOrder) => { setSelNo(o.fiscalDocNo); setPickedQty({}) }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Закрытые заказы" />
      <div className="flex-1 flex overflow-hidden">
        {/* список */}
        <div className="w-80 bg-black/30 overflow-auto">
          <div className="p-2 sticky top-0 bg-black/40">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск: № заказа / официант"
              className="w-full h-9 rounded px-2 text-gray-800 text-sm outline-none" />
          </div>
          {closedOrders.length === 0 && <div className="p-4 text-white/40">Нет закрытых заказов</div>}
          {closedOrders.length > 0 && visible.length === 0 && <div className="p-4 text-white/40 text-sm">Ничего не найдено</div>}
          {visible.map((o) => (
            <button key={o.fiscalDocNo} onClick={() => selectOrder(o)}
              className={`w-full text-left px-4 py-2 border-b border-white/10 ${selNo === o.fiscalDocNo ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
              <div className="flex justify-between"><span>Заказ №{o.id}</span><span>{formatTenge(o.total)}</span></div>
              <div className="text-xs text-white/50">{o.paidAt} · {o.payments.map((p) => p.name).join(', ')}</div>
            </button>
          ))}
        </div>

        {/* детали */}
        <div className="flex-1 p-6 overflow-auto">
          {!order ? <div className="text-white/40">Выберите заказ слева</div> : (
            <div className="max-w-xl">
              <div className="flex justify-between mb-2">
                <div className="text-lg">Заказ №{order.id} · {order.waiter}</div>
                <div className="text-sm text-white/50">ФД №{order.fiscalDocNo}</div>
              </div>
              <div className="bg-white/5 rounded-lg overflow-hidden mb-3">
                {order.lines.map((l) => {
                  const ret = returnedQty(l.uid)
                  const rem = remainingOf(l.uid, l.qty)
                  const pick = pickedQty[l.uid] ?? 0
                  return (
                    <div key={l.uid} className="flex items-center gap-3 px-3 py-2 border-b border-white/10">
                      <div className="flex-1">
                        <div>{l.name} <span className="text-white/40">×{fmtQty(l.qty)}</span></div>
                        {ret > 0 && <div className="text-xs text-pos-rose">возвращено {fmtQty(ret)} · остаток {fmtQty(rem)}</div>}
                      </div>
                      {rem <= 0 ? (
                        <span className="text-pos-rose text-xs">возвращено полностью</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setQty(l.uid, pick - 1, rem)} disabled={pick <= 0}
                            className="w-8 h-8 rounded bg-white/10 disabled:opacity-30 flex items-center justify-center"><Minus size={15} /></button>
                          <span className="w-10 text-center tabular-nums">{fmtQty(pick)}</span>
                          <button onClick={() => setQty(l.uid, pick + 1, rem)} disabled={pick >= rem}
                            className="w-8 h-8 rounded bg-white/10 disabled:opacity-30 flex items-center justify-center"><Plus size={15} /></button>
                          <button onClick={() => setQty(l.uid, rem, rem)} title="вернуть весь остаток позиции"
                            className="h-8 px-2 rounded bg-white/10 text-xs ml-1">всё</button>
                        </div>
                      )}
                      <span className="w-24 text-right">{formatTenge(lineUnitPrice(l) * (pick || rem))}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between px-3 py-2 font-bold"><span>ИТОГО</span><span>{formatTenge(order.total)}</span></div>
              </div>

              {orderRefunds.length > 0 && (
                <div className="text-sm text-pos-rose mb-3">
                  Возвраты: {orderRefunds.map((r) => `№${r.fiscalDocNo} (${formatTenge(r.amount)})`).join(', ')}
                </div>
              )}

              {!cashShift && <div className="text-pos-rose text-sm mb-2">Для возврата откройте кассовую смену.</div>}
              {fullyReturned && <div className="text-pos-rose text-sm mb-2">Заказ полностью возвращён — повторный возврат недоступен.</div>}
              <div className="flex flex-wrap gap-2">
                <button onClick={doPartial} disabled={!pickedAny || !cashShift}
                  className={`h-11 px-4 rounded-md ${pickedAny && cashShift ? 'bg-pos-blue' : 'bg-gray-600 opacity-40'}`}>
                  Возврат по количеству{pickedAny ? ` (${formatTenge(pickedSum)})` : ''}
                </button>
                <button onClick={doFull} disabled={!cashShift || fullyReturned}
                  className="h-11 px-4 rounded-md bg-pos-rose text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed">
                  {anyReturned ? 'Возврат остатка' : 'Полный возврат'}
                </button>
                <button onClick={openChange} disabled={!canChangePay}
                  className="h-11 px-4 rounded-md bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={canChangePay ? '' : 'Нужно право F_CHPAY'}>Изменить тип оплаты</button>
                <button onClick={() => printToast('Товарный чек')} className="h-11 px-4 rounded-md bg-white/10">Печать товарного</button>
              </div>

              {changing && (
                <div className="mt-3 bg-white/5 rounded-lg p-3 max-w-md">
                  <div className="text-sm text-white/60 mb-2">Распределите сумму заказа ({formatTenge(order.total)}) по типам оплаты:</div>
                  <div className="space-y-1.5">
                    {paymentTypes.filter((pt) => pt.active).map((pt) => (
                      <div key={pt.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{pt.name}</span>
                        <input value={splitAmt[pt.id] ?? ''} onChange={(e) => setSplitAmt((s) => ({ ...s, [pt.id]: e.target.value.replace(/[^\d.,]/g, '') }))}
                          inputMode="decimal" placeholder="0" className="w-28 h-9 rounded px-2 text-gray-800 text-right" />
                        <button onClick={() => setSplitAmt((s) => ({ ...s, [pt.id]: String(+(parseAmt(splitAmt[pt.id] ?? '') - splitDiff).toFixed(2)) }))}
                          className="h-9 px-2 rounded bg-white/10 text-xs" title="дозаполнить до итога">остаток</button>
                      </div>
                    ))}
                  </div>
                  <div className={`flex justify-between text-sm mt-2 ${Math.abs(splitDiff) < 0.01 ? 'text-pos-green' : 'text-pos-rose'}`}>
                    <span>Распределено: {formatTenge(splitSum)}</span>
                    <span>{splitDiff === 0 ? '✓ сходится' : splitDiff > 0 ? `излишек ${formatTenge(splitDiff)}` : `не хватает ${formatTenge(-splitDiff)}`}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={applyChange} disabled={Math.abs(splitDiff) > 0.01}
                      className="h-10 px-4 rounded-md bg-pos-green text-white disabled:opacity-40">Применить</button>
                    <button onClick={() => { setChanging(false); setSplitAmt({}) }} className="h-10 px-4 rounded-md bg-gray-600">Отмена</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>

      {refundReq && (
        <RefundModal title={refundReq.title} amount={refundReq.amount}
          onConfirm={confirmRefund} onCancel={() => setRefundReq(null)} />
      )}
    </div>
  )
}
