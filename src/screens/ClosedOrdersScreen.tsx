import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineTotal } from '../store/pos'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'
import RefundModal from '../components/RefundModal'

// Закрытые заказы + возвраты (частичный/полный) и изменение типа оплаты (FRONT_03 §2.6).
export default function ClosedOrdersScreen() {
  const navigate = useNavigate()
  const { closedOrders, refunds, refundOrder, changePaymentType, cashShift, paymentTypes, can } = usePos()
  const [selNo, setSelNo] = useState<string | null>(closedOrders[0]?.fiscalDocNo ?? null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [changing, setChanging] = useState(false)
  const [q, setQ] = useState('') // поиск по № заказа / официанту
  const canChangePay = can('F_CHPAY')
  const visible = closedOrders.filter((o) => !q || String(o.id).includes(q.trim()) || o.waiter.toLowerCase().includes(q.trim().toLowerCase()))
  const [refundReq, setRefundReq] = useState<{ uids: string[] | 'all'; amount: number; title: string } | null>(null)

  const order = closedOrders.find((o) => o.fiscalDocNo === selNo) ?? null
  const orderRefunds = order ? refunds.filter((r) => r.orderId === order.id) : []
  const pickedUids = Object.keys(picked).filter((u) => picked[u])
  const pickedSum = order ? order.lines.filter((l) => pickedUids.includes(l.uid)).reduce((s, l) => s + lineTotal(l), 0) : 0

  const doPartial = () => {
    if (!order || pickedUids.length === 0) return
    setRefundReq({ uids: pickedUids, amount: pickedSum, title: 'Частичный возврат' })
  }
  const doFull = () => {
    if (!order) return
    setRefundReq({ uids: 'all', amount: order.total, title: 'Полный возврат' })
  }
  const confirmRefund = (opts: { reason: string; restock: boolean; by: string; method: 'cash' | 'card'; uids?: string[] | 'all' }) => {
    if (!order || !refundReq) return
    const r = refundOrder(order.fiscalDocNo, refundReq.uids, opts)
    if (r) {
      printToast(`Возвратный чек №${r.fiscalDocNo} на ${formatTenge(r.amount)} (Webkassa)\nПричина: ${opts.reason}${opts.restock ? ' · на склад' : ''} · ${opts.by}`)
      setPicked({})
    }
    setRefundReq(null)
  }
  const doChange = (ptId: string) => {
    if (!order) return
    const pt = paymentTypes.find((p) => p.id === ptId)!
    changePaymentType(order.fiscalDocNo, [{ paymentTypeId: pt.id, name: pt.name, amount: order.total }])
    setChanging(false)
  }

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
            <button key={o.fiscalDocNo} onClick={() => { setSelNo(o.fiscalDocNo); setPicked({}) }}
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
                {order.lines.map((l) => (
                  <label key={l.uid} className="flex items-center gap-3 px-3 py-2 border-b border-white/10 cursor-pointer">
                    <input type="checkbox" checked={!!picked[l.uid]} onChange={(e) => setPicked((p) => ({ ...p, [l.uid]: e.target.checked }))} />
                    <span className="flex-1">{l.name} ×{l.qty}</span>
                    <span>{formatTenge(lineTotal(l))}</span>
                  </label>
                ))}
                <div className="flex justify-between px-3 py-2 font-bold"><span>ИТОГО</span><span>{formatTenge(order.total)}</span></div>
              </div>

              {orderRefunds.length > 0 && (
                <div className="text-sm text-pos-rose mb-3">
                  Возвраты: {orderRefunds.map((r) => `№${r.fiscalDocNo} (${formatTenge(r.amount)})`).join(', ')}
                </div>
              )}

              {!cashShift && <div className="text-pos-rose text-sm mb-2">Для возврата откройте кассовую смену.</div>}
              <div className="flex flex-wrap gap-2">
                <button onClick={doPartial} disabled={pickedUids.length === 0 || !cashShift}
                  className={`h-11 px-4 rounded-md ${pickedUids.length && cashShift ? 'bg-pos-blue' : 'bg-gray-600 opacity-40'}`}>
                  Частичный возврат{pickedUids.length > 0 ? ` (${formatTenge(pickedSum)})` : ''}
                </button>
                <button onClick={doFull} disabled={!cashShift} className="h-11 px-4 rounded-md bg-pos-rose text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed">Полный возврат</button>
                <button onClick={() => setChanging(true)} disabled={!canChangePay}
                  className="h-11 px-4 rounded-md bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={canChangePay ? '' : 'Нужно право F_CHPAY'}>Изменить тип оплаты</button>
                <button onClick={() => printToast('Товарный чек')} className="h-11 px-4 rounded-md bg-white/10">Печать товарного</button>
              </div>

              {changing && (
                <div className="mt-3 bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-white/60 mb-2">Новый тип оплаты для всего заказа:</div>
                  <div className="flex flex-wrap gap-2">
                    {paymentTypes.map((pt) => (
                      <button key={pt.id} onClick={() => doChange(pt.id)} className="h-10 px-4 rounded-md bg-pos-blue">{pt.name}</button>
                    ))}
                    <button onClick={() => setChanging(false)} className="h-10 px-4 rounded-md bg-gray-600">Отмена</button>
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
