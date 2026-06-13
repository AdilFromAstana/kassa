import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineTotal } from '../store/pos'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'
import RefundModal from '../components/RefundModal'
import { printToast } from '../lib/print'

// Заказы закрытых кассовых смен (КАССА → Заказы закрытых кассовых смен): архив прошлых смен +
// возврат оплаты по заказу из архива (через RefundModal — причина/режим/право, как в ClosedOrders).
export default function ClosedShiftsScreen() {
  const navigate = useNavigate()
  const { closedShifts, refundOrder, refunds, cashShift } = usePos()
  const [selNo, setSelNo] = useState<number | null>(closedShifts[0]?.no ?? null)
  const [refundReq, setRefundReq] = useState<{ receiptNo: string; title: string; lines: { uid: string; name: string; qty: number; total: number }[] } | null>(null)
  const shift = closedShifts.find((s) => s.no === selNo) ?? null
  const isRefunded = (orderId: number) => refunds.some((r) => r.orderId === orderId)
  const confirmRefund = (opts: { reason: string; restock: boolean; by: string; uids?: string[] | 'all' }) => {
    if (!refundReq) return
    const r = refundOrder(refundReq.receiptNo, opts.uids ?? 'all', opts)
    if (r) printToast(`Возвратный чек №${r.fiscalDocNo} на ${formatTenge(r.amount)} (Webkassa)\nПричина: ${opts.reason}${opts.restock ? ' · на склад' : ''} · ${opts.by}`)
    setRefundReq(null)
  }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Заказы закрытых кассовых смен" />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 bg-black/30 overflow-auto">
          {closedShifts.length === 0 && <div className="p-4 text-white/40 text-sm">Закрытых смен ещё нет. Закройте текущую кассовую смену — она попадёт в архив.</div>}
          {closedShifts.map((s) => (
            <button key={s.no} onClick={() => setSelNo(s.no)}
              className={`w-full text-left px-4 py-2 border-b border-white/10 ${selNo === s.no ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
              <div className="flex justify-between"><span>Смена №{s.no}</span><span>{formatTenge(s.revenue)}</span></div>
              <div className="text-xs text-white/50">{s.closedAt} · чеков: {s.orders.length}</div>
            </button>
          ))}
        </div>
        <div className="flex-1 p-6 overflow-auto">
          {!shift ? <div className="text-white/40">Выберите смену слева</div> : (
            <div className="max-w-2xl">
              <div className="mb-3 text-sm text-white/60">Смена №{shift.no} · открыта {shift.openedAt} · закрыта {shift.closedAt}</div>
              {!cashShift && <div className="text-pos-rose text-sm mb-3">Для возврата откройте кассовую смену — возврат проводится на ФР текущей открытой смены.</div>}
              {shift.orders.length === 0 ? <div className="text-white/40">В смене не было закрытых заказов</div> : (
                <table className="w-full text-sm">
                  <thead className="text-white/50 text-left"><tr><th className="p-2">№/ФД</th><th>Время</th><th>Официант</th><th>Оплата</th><th className="text-right">Сумма</th><th></th></tr></thead>
                  <tbody>
                    {shift.orders.map((o) => (
                      <tr key={o.fiscalDocNo} className="border-b border-white/10">
                        <td className="p-2">{o.id} / {o.fiscalDocNo}</td>
                        <td>{o.paidAt.split(', ')[1] ?? o.paidAt}</td>
                        <td>{o.waiter}</td>
                        <td>{o.payments.map((p) => p.name).join(', ')}</td>
                        <td className="text-right">{formatTenge(o.total)}</td>
                        <td className="text-right pl-3">
                          {isRefunded(o.id)
                            ? <span className="text-pos-rose text-xs">возвращён</span>
                            : <button disabled={!cashShift}
                                onClick={() => setRefundReq({ receiptNo: o.fiscalDocNo, title: `Возврат · ФД №${o.fiscalDocNo}`, lines: o.lines.map((l) => ({ uid: l.uid, name: l.name, qty: l.qty, total: lineTotal(l) })) })}
                                className="h-8 px-3 rounded bg-pos-rose text-gray-900 text-xs whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                                title={cashShift ? '' : 'Откройте кассовую смену для возврата'}>Вернуть оплату</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>

      {refundReq && (
        <RefundModal title={refundReq.title} lines={refundReq.lines}
          onConfirm={confirmRefund} onCancel={() => setRefundReq(null)} />
      )}
    </div>
  )
}
