import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { usePos, orderTotal } from '../store/pos'
import { findTable, halls } from '../mock/data'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'

// Открытые заказы (КАССА → Открытые заказы): активные заказы текущей смены,
// сгруппированы по официантам (как в iikoFront), карточки с переходом в заказ.
export default function OpenOrdersScreen() {
  const navigate = useNavigate()
  const { orders, openExistingOrder } = usePos()

  const hallName = (id: string | null) => (id ? halls.find((h) => h.id === id)?.name ?? '' : '')
  const place = (o: typeof orders[number]) => (o.tableId ? `${hallName(o.hallId)}, стол ${findTable(o.tableId)?.no ?? ''}` : 'Быстрый чек')
  const open = (id: number) => { openExistingOrder(id); navigate('/order') }

  const waiters = Array.from(new Set(orders.map((o) => o.waiter)))
  const totalSum = orders.reduce((s, o) => s + orderTotal(o), 0)

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Открытые заказы" />
      <div className="px-6 pt-4 text-white/60 text-sm">
        Открытых заказов: <b className="text-white">{orders.length}</b> · на сумму <b className="text-white">{formatTenge(totalSum)}</b>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {orders.length === 0 ? (
          <div className="text-white/40">Нет открытых заказов</div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            {waiters.map((w) => {
              const ws = orders.filter((o) => o.waiter === w)
              return (
                <div key={w}>
                  <div className="text-pos-accent text-sm uppercase mb-2">{w} · {ws.length} зак. · {formatTenge(ws.reduce((s, o) => s + orderTotal(o), 0))}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {ws.map((o) => (
                      <button key={o.id} onClick={() => open(o.id)}
                        className="bg-white/5 hover:bg-white/10 rounded-lg p-4 text-left">
                        <div className="flex justify-between items-baseline">
                          <span className="font-semibold">Заказ №{o.id}</span>
                          <span className="text-pos-accent">{formatTenge(orderTotal(o))}</span>
                        </div>
                        <div className="text-xs text-white/50 mt-1">{place(o)} · {o.guests} гост.</div>
                        <div className="text-xs text-white/40">{o.openedAt} · позиций: {o.lines.length}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
