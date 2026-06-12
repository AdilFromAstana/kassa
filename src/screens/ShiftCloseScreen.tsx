import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { usePos, orderTotal } from '../store/pos'
import { Check } from 'lucide-react'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Мастер закрытия кассовой смены (FRONT_03 §5.3): незакрытые заказы → пересчёт → отчёты → Z-отчёт.
export default function ShiftCloseScreen() {
  const navigate = useNavigate()
  const { orders, closedOrders, cashShift, cashMovements, closeCashShift } = usePos()
  const [step, setStep] = useState(1)
  const [counted, setCounted] = useState('')

  const cashSales = closedOrders
    .flatMap((o) => o.payments)
    .filter((p) => p.name === 'Наличные')
    .reduce((s, p) => s + p.amount, 0)
  const cashIn = cashMovements.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0)
  const cashOut = cashMovements.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0)
  const cashExpected = +(cashSales + cashIn - cashOut).toFixed(2)
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)

  const finish = () => { printToast(`Z-отчёт · смена №${cashShift?.no} закрыта (гашение ФР)`); closeCashShift(); navigate('/menu') }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title={`Закрытие кассовой смены №${cashShift?.no ?? ''}`} />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-2 mb-6 text-sm">
          {['Незакрытые заказы', 'Контрольный пересчёт', 'Отчёты', 'Z-отчёт'].map((t, i) => (
            <div key={t} className={`px-3 py-1 rounded-full ${step === i + 1 ? 'bg-pos-accent text-black' : 'bg-white/10'}`}>{i + 1}. {t}</div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <div className="mb-3 text-white/70">Незакрытые заказы текущей смены ({orders.length}):</div>
            {orders.length === 0
              ? <div className="text-pos-green flex items-center gap-2"><Check size={16} /> Все заказы закрыты</div>
              : (
                <table className="w-full max-w-2xl text-sm">
                  <thead className="text-white/50"><tr><th className="text-left">Время</th><th className="text-left">Стол</th><th className="text-left">Официант</th><th className="text-right">Сумма</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-white/10">
                        <td>{o.openedAt}</td><td>{o.tableId?.replace(/^t-/, '') ?? '—'}</td><td>{o.waiter}</td>
                        <td className="text-right">{formatTenge(orderTotal(o))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            <div className="text-xs text-white/40 mt-2">Незакрытые заказы переносятся в следующую смену (мок).</div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-md">
            <div className="mb-2 text-white/70">Введите фактическую сумму наличных в кассе:</div>
            <input value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ''))}
              className="w-full h-12 rounded-md px-3 text-black text-xl" placeholder="0" />
            <div className="mt-3 text-sm space-y-1">
              <div className="flex justify-between text-white/50"><span>Продажи за наличные:</span><span>{formatTenge(cashSales)}</span></div>
              <div className="flex justify-between text-white/50"><span>+ внесения:</span><span>{formatTenge(cashIn)}</span></div>
              <div className="flex justify-between text-white/50"><span>− изъятия:</span><span>{formatTenge(cashOut)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1"><span>Расчётная сумма наличных:</span><b>{formatTenge(cashExpected)}</b></div>
              <div className="flex justify-between"><span>Введено фактически:</span><b>{formatTenge(parseFloat(counted) || 0)}</b></div>
              <div className="flex justify-between text-pos-accent"><span>Расхождение:</span><b>{formatTenge((parseFloat(counted) || 0) - cashExpected)}</b></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-md">
            <div className="mb-3 text-white/70">Отчёты к печати при закрытии смены:</div>
            {['041 Выручка по типам с налогами', '043 Продажи блюд', '045 Полный отчёт кассовой смены', '048 Итого по смене'].map((r) => (
              <label key={r} className="flex items-center gap-2 py-1"><input type="checkbox" defaultChecked /> {r}</label>
            ))}
            <button onClick={() => printToast('Отчёты смены распечатаны')} className="mt-3 h-10 px-6 rounded-md bg-pos-blue">Печать отчётов</button>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-md">
            <div className="mb-3 text-white/70">Изъятие наличных и печать <b>Z-отчёта</b> (гашение ФР Webkassa):</div>
            <div className="bg-white/5 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Выручка за смену:</span><b>{formatTenge(revenue)}</b></div>
              <div className="flex justify-between"><span>Чеков закрыто:</span><b>{closedOrders.length}</b></div>
              <div className="flex justify-between"><span>К изъятию (наличные):</span><b>{formatTenge(cashExpected)}</b></div>
            </div>
            <div className="text-xs text-white/40 mt-2">После закрытия счётчик ФР гасится, смена №{cashShift?.no} закрывается.</div>
          </div>
        )}
      </div>

      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-4">
        <BackButton onClick={() => (step === 1 ? navigate('/menu') : setStep(step - 1))} label={step === 1 ? 'ОТМЕНА' : 'НАЗАД'} />
        {step < 4
          ? <button onClick={() => setStep(step + 1)} className="ml-auto h-12 px-10 rounded-md bg-pos-blue text-white">Далее ›</button>
          : <button onClick={finish} className="ml-auto h-12 px-10 rounded-md bg-pos-green text-white">Закрыть смену + Z-отчёт</button>}
      </div>
    </div>
  )
}
