import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { usePos, orderTotal } from '../store/pos'
import { findTable, halls } from '../mock/data'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'

// Открытые заказы (КАССА → Открытые заказы): все активные заказы текущей смены.
export default function OpenOrdersScreen() {
  const navigate = useNavigate()
  const { orders, openExistingOrder } = usePos()

  const hallName = (id: string | null) => (id ? halls.find((h) => h.id === id)?.name ?? '' : '')
  const open = (id: number) => { openExistingOrder(id); navigate('/order') }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Открытые заказы" />
      <div className="flex-1 overflow-auto p-6">
        {orders.length === 0 ? (
          <div className="text-white/40">Нет открытых заказов</div>
        ) : (
          <table className="w-full max-w-3xl text-sm">
            <thead className="text-white/50 text-left"><tr>
              <th className="p-2">№</th><th>Время</th><th>Зал / стол</th><th>Гостей</th><th>Официант</th><th>Позиций</th><th className="text-right">Сумма</th><th></th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-white/10">
                  <td className="p-2">{o.id}</td>
                  <td>{o.openedAt}</td>
                  <td>{o.tableId ? `${hallName(o.hallId)}, ${findTable(o.tableId)?.no}` : 'Быстрый чек'}</td>
                  <td>{o.guests}</td>
                  <td>{o.waiter}</td>
                  <td>{o.lines.length}</td>
                  <td className="text-right">{formatTenge(orderTotal(o))}</td>
                  <td className="text-right"><button onClick={() => open(o.id)} className="bg-pos-blue px-3 py-1 rounded text-xs">Открыть</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
