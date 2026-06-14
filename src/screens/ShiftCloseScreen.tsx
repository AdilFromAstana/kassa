import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { usePos, orderTotal } from '../store/pos'
import { Check, X } from 'lucide-react'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Номиналы тенге (банкноты + крупные монеты) для купюрной раскладки контрольного пересчёта.
const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20]

// Мастер закрытия кассовой смены (FRONT_03 §5.3): незакрытые заказы → пересчёт → отчёты → Z-отчёт.
export default function ShiftCloseScreen() {
  const navigate = useNavigate()
  const { orders, closedOrders, cashShift, cashMovements, refunds, closeCashShift, forceCloseOrder, addCashMovement } = usePos()
  const [step, setStep] = useState(1)
  const [denoms, setDenoms] = useState<Record<number, string>>({})
  const [fundStr, setFundStr] = useState('') // разменный фонд, оставляемый на след. смену

  const cashSales = closedOrders
    .flatMap((o) => o.payments)
    .filter((p) => p.name === 'Наличные')
    .reduce((s, p) => s + p.amount, 0)
  const cashIn = cashMovements.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0)
  const cashOut = cashMovements.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0)
  // возвраты наличными уменьшают деньги в ящике (карточные — нет)
  const cashRefunds = +refunds.filter((r) => r.method !== 'card').reduce((s, r) => s + r.amount, 0).toFixed(2)
  const cashExpected = +(cashSales + cashIn - cashOut - cashRefunds).toFixed(2)
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)

  // купюрная раскладка → фактически пересчитанная сумма наличных
  const counted = DENOMS.reduce((s, d) => s + d * (parseInt(denoms[d] || '', 10) || 0), 0)
  const diff = +(counted - cashExpected).toFixed(2)

  // инкассация: оставляем разменный фонд (по умолч. фонд открытия), остальное инкассируется
  const defaultFund = cashShift?.openingCash ?? 0
  const fund = fundStr === '' ? defaultFund : (parseFloat(fundStr) || 0)
  const collected = Math.max(0, +(cashExpected - fund).toFixed(2)) // сумма инкассации

  const setDenom = (d: number, v: string) => setDenoms((s) => ({ ...s, [d]: v.replace(/\D/g, '') }))

  const finish = () => {
    if (collected > 0) addCashMovement('out', 'Инкассация', collected, `Инкассация при закрытии смены №${cashShift?.no}`)
    printToast(`Инкассация ${formatTenge(collected)} · разменный фонд ${formatTenge(fund)}\nZ-отчёт · смена №${cashShift?.no} закрыта (гашение ФР)`)
    closeCashShift(); navigate('/menu')
  }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title={`Закрытие кассовой смены №${cashShift?.no ?? ''}`} />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-2 mb-6 text-sm">
          {['Незакрытые заказы', 'Контрольный пересчёт', 'Инкассация', 'Отчёты', 'Z-отчёт'].map((t, i) => (
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
                  <thead className="text-white/50"><tr><th className="text-left">Время</th><th className="text-left">Стол</th><th className="text-left">Официант</th><th className="text-right">Сумма</th><th></th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-white/10">
                        <td>{o.openedAt}</td><td>{o.tableId?.replace(/^t-/, '') ?? '—'}</td><td>{o.waiter}</td>
                        <td className="text-right">{formatTenge(orderTotal(o))}</td>
                        <td className="text-right pl-3">
                          <button onClick={() => { forceCloseOrder(o.id); printToast(`Заказ №${o.id} закрыт принудительно`) }}
                            className="text-xs bg-pos-rose text-gray-900 px-2 py-1 rounded inline-flex items-center gap-1"><X size={12} />Закрыть</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            <div className="text-xs text-white/40 mt-2">Закройте незакрытые заказы принудительно — иначе они будут перенесены в следующую смену.</div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl">
            <div className="mb-3 text-white/70">Купюрная раскладка — пересчитайте наличные в денежном ящике:</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-white/5 rounded-lg p-4">
              {DENOMS.map((d) => {
                const cnt = parseInt(denoms[d] || '', 10) || 0
                return (
                  <div key={d} className="flex items-center gap-2">
                    <span className="w-20 text-right text-white/70">{d.toLocaleString('ru-RU')} ₸</span>
                    <span className="text-white/40">×</span>
                    <input value={denoms[d] || ''} onChange={(e) => setDenom(d, e.target.value)} inputMode="numeric" placeholder="0"
                      className="w-20 h-9 rounded px-2 text-black text-center" />
                    <span className="ml-auto text-white/50 text-sm">{formatTenge(d * cnt)}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-sm space-y-1 max-w-md">
              <div className="flex justify-between text-white/50"><span>Продажи за наличные:</span><span>{formatTenge(cashSales)}</span></div>
              <div className="flex justify-between text-white/50"><span>+ внесения (вкл. разменный фонд):</span><span>{formatTenge(cashIn)}</span></div>
              <div className="flex justify-between text-white/50"><span>− изъятия:</span><span>{formatTenge(cashOut)}</span></div>
              {cashRefunds > 0 && <div className="flex justify-between text-white/50"><span>− возвраты наличными:</span><span>{formatTenge(cashRefunds)}</span></div>}
              <div className="flex justify-between border-t border-white/10 pt-1"><span>Расчётная сумма наличных:</span><b>{formatTenge(cashExpected)}</b></div>
              <div className="flex justify-between"><span>Пересчитано фактически:</span><b>{formatTenge(counted)}</b></div>
              <div className={`flex justify-between ${diff === 0 ? 'text-pos-green' : 'text-pos-rose'}`}><span>Расхождение:</span><b>{formatTenge(diff)}</b></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-md">
            <div className="mb-3 text-white/70">Инкассация — изъятие выручки из кассы (в сейф/банк), оставляя разменный фонд на следующую смену:</div>
            <div className="bg-white/5 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Расчётная наличность в ящике:</span><b>{formatTenge(cashExpected)}</b></div>
              <label className="flex justify-between items-center pt-1">
                <span>Разменный фонд (оставить):</span>
                <input value={fundStr} onChange={(e) => setFundStr(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder={String(defaultFund)} className="w-32 h-9 rounded px-2 text-black text-right" />
              </label>
              <div className="flex justify-between border-t border-white/10 pt-1 text-pos-accent"><span>К инкассации:</span><b>{formatTenge(collected)}</b></div>
            </div>
            <div className="text-xs text-white/40 mt-2">Инкассируемая сумма спишется из кассы операцией «Инкассация» (изъятие). Разменный фонд остаётся в ящике для размена.</div>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-md">
            <div className="mb-3 text-white/70">Отчёты к печати при закрытии смены:</div>
            {['041 Выручка по типам с налогами', '043 Продажи блюд', '045 Полный отчёт кассовой смены', '048 Итого по смене'].map((r) => (
              <label key={r} className="flex items-center gap-2 py-1"><input type="checkbox" defaultChecked /> {r}</label>
            ))}
            <button onClick={() => printToast('Отчёты смены распечатаны')} className="mt-3 h-10 px-6 rounded-md bg-pos-blue">Печать отчётов</button>
          </div>
        )}

        {step === 5 && (
          <div className="max-w-md">
            <div className="mb-3 text-white/70">Печать <b>Z-отчёта</b> (гашение ФР Webkassa) и закрытие смены:</div>
            <div className="bg-white/5 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Выручка за смену:</span><b>{formatTenge(revenue)}</b></div>
              <div className="flex justify-between"><span>Чеков закрыто:</span><b>{closedOrders.length}</b></div>
              <div className="flex justify-between border-t border-white/10 pt-1"><span>Инкассировано:</span><b>{formatTenge(collected)}</b></div>
              <div className="flex justify-between"><span>Разменный фонд оставлен:</span><b>{formatTenge(fund)}</b></div>
            </div>
            <div className="text-xs text-white/40 mt-2">После закрытия счётчик ФР гасится, смена №{cashShift?.no} закрывается.</div>
          </div>
        )}
      </div>

      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-4">
        <BackButton onClick={() => (step === 1 ? navigate('/menu') : setStep(step - 1))} label={step === 1 ? 'ОТМЕНА' : 'НАЗАД'} />
        {step < 5
          ? <button onClick={() => setStep(step + 1)} className="ml-auto h-12 px-10 rounded-md bg-pos-blue text-white">Далее ›</button>
          : <button onClick={finish} className="ml-auto h-12 px-10 rounded-md bg-pos-green text-white">Закрыть смену + Z-отчёт</button>}
      </div>
    </div>
  )
}
