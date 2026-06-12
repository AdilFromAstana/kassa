import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineTotal } from '../store/pos'
import { paymentTypes } from '../mock/data'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Закрытые заказы + возвраты (частичный/полный) и изменение типа оплаты (FRONT_03 §2.6).
export default function ClosedOrdersScreen() {
  const navigate = useNavigate()
  const { closedOrders, refunds, refundOrder, changePaymentType } = usePos()
  const [selNo, setSelNo] = useState<string | null>(closedOrders[0]?.fiscalDocNo ?? null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [changing, setChanging] = useState(false)

  const order = closedOrders.find((o) => o.fiscalDocNo === selNo) ?? null
  const orderRefunds = order ? refunds.filter((r) => r.orderId === order.id) : []
  const pickedUids = Object.keys(picked).filter((u) => picked[u])
  const pickedSum = order ? order.lines.filter((l) => pickedUids.includes(l.uid)).reduce((s, l) => s + lineTotal(l), 0) : 0

  const doPartial = () => {
    if (!order || pickedUids.length === 0) return
    const r = refundOrder(order.fiscalDocNo, pickedUids)
    if (r) { printToast(`Возвратный чек №${r.fiscalDocNo} на ${formatTenge(r.amount)} (Webkassa)`); setPicked({}) }
  }
  const doFull = () => {
    if (!order) return
    if (!confirm('Полный возврат по чеку?')) return
    const r = refundOrder(order.fiscalDocNo, 'all')
    if (r) printToast(`Полный возврат №${r.fiscalDocNo} на ${formatTenge(r.amount)}`)
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
          {closedOrders.length === 0 && <div className="p-4 text-white/40">Нет закрытых заказов</div>}
          {closedOrders.map((o) => (
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

              <div className="flex flex-wrap gap-2">
                <button onClick={doPartial} disabled={pickedUids.length === 0}
                  className={`h-11 px-4 rounded-md ${pickedUids.length ? 'bg-pos-blue' : 'bg-gray-600 opacity-40'}`}>
                  Частичный возврат{pickedUids.length > 0 ? ` (${formatTenge(pickedSum)})` : ''}
                </button>
                <button onClick={doFull} className="h-11 px-4 rounded-md bg-pos-rose text-gray-900">Полный возврат</button>
                <button onClick={() => setChanging(true)} className="h-11 px-4 rounded-md bg-white/10">Изменить тип оплаты</button>
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
    </div>
  )
}
