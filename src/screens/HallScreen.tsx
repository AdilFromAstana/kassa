import { useEffect, useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, orderTotal } from '../store/pos'
import { halls, tablesByHall } from '../mock/data'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'
import GuestCountModal from '../components/GuestCountModal'
import type { Table } from '../types'

// Схема зала: выбор зала и стола. Свободный → ввод гостей → новый заказ. Занятый → открыть заказ.
export default function HallScreen() {
  const navigate = useNavigate()
  const { orders, startOrder, openExistingOrder, establishment } = usePos()
  const [hallId, setHallId] = useState(halls[0].id)
  const [guestTable, setGuestTable] = useState<Table | null>(null)

  // фастфуд — столов нет, на схему зала не пускаем
  useEffect(() => { if (establishment.mode === 'fastfood') navigate('/menu') }, [establishment.mode, navigate])

  const openOrderOnTable = (tableId: string) => orders.find((o) => o.tableId === tableId)

  const onTable = (t: Table) => {
    const existing = openOrderOnTable(t.id)
    if (existing) { openExistingOrder(existing.id); navigate('/order') }
    else setGuestTable(t)
  }

  const confirmGuests = (n: number) => {
    startOrder({ tableId: guestTable!.id, hallId, guests: n })
    setGuestTable(null)
    navigate('/order')
  }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Заказы — схема зала" />
      <div className="flex-1 flex overflow-hidden">
        {/* список залов */}
        <div className="w-44 bg-black/30 flex flex-col">
          {halls.map((h) => {
            const cnt = orders.filter((o) => o.hallId === h.id).length
            return (
              <button key={h.id} onClick={() => setHallId(h.id)}
                className={`h-16 px-4 text-left border-b border-white/10 flex items-center justify-between
                  ${hallId === h.id ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
                <span>{h.name}</span>
                {cnt > 0 && <span className="text-xs bg-pos-accent text-black rounded-full px-2 py-0.5">{cnt}</span>}
              </button>
            )
          })}
        </div>
        {/* план столов */}
        <div className="flex-1 p-6">
          <div className="grid grid-cols-3 gap-4 max-w-3xl">
            {tablesByHall(hallId).map((t) => {
              const ord = openOrderOnTable(t.id)
              return (
                <button key={t.id} onClick={() => onTable(t)}
                  className={`h-28 rounded-lg flex flex-col items-center justify-center gap-1 transition active:scale-95
                    ${ord ? 'bg-pos-accent text-black' : 'bg-white/10 hover:bg-white/20'}`}>
                  <div className="text-2xl font-bold">{t.no}</div>
                  <div className="text-xs opacity-70">{t.seats} мест</div>
                  {ord && <div className="text-xs font-semibold">{formatTenge(orderTotal(ord))}</div>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="h-14 bg-white text-gray-700 flex items-center px-4 gap-6 shrink-0">
        <BackButton onClick={() => navigate('/menu')} />
        <span className="text-sm">Схема зала · Все столы · По официантам · Быстрый чек</span>
      </div>

      {/* выбор количества гостей (1:1 с iikoFront) */}
      {guestTable && (
        <GuestCountModal onOk={confirmGuests} onCancel={() => setGuestTable(null)} />
      )}
    </div>
  )
}
