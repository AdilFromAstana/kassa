import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineTotal } from '../store/pos'
import { formatTenge, vatAmount } from '../lib/money'
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
  const [showZ, setShowZ] = useState(false)
  const shift = closedShifts.find((s) => s.no === selNo) ?? null
  const isRefunded = (orderId: number) => refunds.some((r) => r.orderId === orderId)

  // агрегаты выбранной смены (для сводки и печати Z-отчёта из архива)
  const agg = (() => {
    if (!shift) return null
    const byType: Record<string, number> = {}
    let guests = 0, disc = 0, surch = 0
    for (const o of shift.orders) {
      for (const p of o.payments) byType[p.name] = (byType[p.name] ?? 0) + p.amount
      guests += o.guests
      const sub = o.lines.reduce((s, l) => s + lineTotal(l), 0)
      disc += sub * (o.discountPct || 0) / 100
      surch += sub * (o.surchargePct || 0) / 100
    }
    const shiftRefunds = refunds.filter((r) => shift.orders.some((o) => o.id === r.orderId))
    const refundsSum = +shiftRefunds.reduce((s, r) => s + r.amount, 0).toFixed(2)
    return { byType, guests, disc, surch, refundsSum, vat: vatAmount(shift.revenue, 16) }
  })()
  const confirmRefund = (opts: { reason: string; restock: boolean; by: string; method: 'cash' | 'card'; uids?: string[] | 'all' }) => {
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
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm text-white/60">Смена №{shift.no} · открыта {shift.openedAt} · закрыта {shift.closedAt}</div>
                <button onClick={() => setShowZ(true)} className="ml-auto h-9 px-4 rounded-md bg-rose-600 text-white text-sm">Печать Z-отчёта</button>
              </div>

              {/* сводные итоги смены (по типам оплат / скидки / гости) */}
              {agg && (
                <div className="bg-white/5 rounded-lg p-3 mb-4 text-sm grid grid-cols-2 gap-x-8 gap-y-1 max-w-lg">
                  <div className="flex justify-between"><span className="text-white/50">Выручка:</span><b>{formatTenge(shift.revenue)}</b></div>
                  <div className="flex justify-between"><span className="text-white/50">Чеков:</span><b>{shift.orders.length}</b></div>
                  {Object.entries(agg.byType).map(([n, v]) => (
                    <div key={n} className="flex justify-between"><span className="text-white/50">{n}:</span><span>{formatTenge(v)}</span></div>
                  ))}
                  <div className="flex justify-between"><span className="text-white/50">Гостей:</span><span>{agg.guests}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Скидки:</span><span>{formatTenge(agg.disc)}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Надбавки:</span><span>{formatTenge(agg.surch)}</span></div>
                </div>
              )}

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

      {showZ && shift && agg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowZ(false)}>
          <div className="bg-white text-gray-800 rounded-lg w-full max-w-sm font-mono text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 max-h-[80vh] overflow-auto">
              <div className="text-center font-bold">Z-ОТЧЁТ (повторная печать)</div>
              <div className="text-center text-xs text-gray-500 mb-3">
                Терминал №998 · Кассовая смена №{shift.no}<br />
                открыта {shift.openedAt}<br />закрыта {shift.closedAt}<br />KZ ҚҚС 16%
              </div>
              <ZRow k="Чеков закрыто" v={String(shift.orders.length)} />
              <ZRow k="Гостей" v={String(agg.guests)} />
              <ZRow k="Выручка" v={formatTenge(shift.revenue)} b />
              <ZRow k="в т.ч. ҚҚС 16%" v={formatTenge(agg.vat)} />
              <ZRow k="без НДС" v={formatTenge(+(shift.revenue - agg.vat).toFixed(2))} />
              <div className="border-t border-dashed my-2" /><div className="text-gray-500">По типам оплаты:</div>
              {Object.keys(agg.byType).length === 0 ? <div className="text-gray-400">— нет —</div>
                : Object.entries(agg.byType).map(([k, v]) => <ZRow key={k} k={k} v={formatTenge(v)} />)}
              <div className="border-t border-dashed my-2" />
              <ZRow k="Скидки" v={formatTenge(agg.disc)} />
              <ZRow k="Надбавки" v={formatTenge(agg.surch)} />
              <ZRow k="Возвраты" v={'− ' + formatTenge(agg.refundsSum)} />
              <div className="text-center text-xs text-gray-400 mt-3 border-t pt-2">Архивный Z-отчёт — смена уже закрыта.</div>
            </div>
            <div className="px-5 py-3 border-t flex gap-3 justify-end font-sans">
              <button onClick={() => setShowZ(false)} className="h-11 px-5 rounded-md border border-gray-300 hover:bg-gray-100">Закрыть</button>
              <button onClick={() => { printToast(`Z-отчёт смены №${shift.no} распечатан (Webkassa)`); setShowZ(false) }}
                className="h-11 px-6 rounded-md bg-rose-600 text-white">Печать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ZRow = ({ k, v, b }: { k: string; v: string; b?: boolean }) => (
  <div className={`flex justify-between py-0.5 gap-3 ${b ? 'font-bold' : ''}`}><span>{k}</span><span className="whitespace-nowrap">{v}</span></div>
)
