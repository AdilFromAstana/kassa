import { useEffect, useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, orderTotal } from '../store/pos'
import { halls, tablesByHall, findTable } from '../mock/data'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'
import GuestCountModal from '../components/GuestCountModal'
import type { Table } from '../types'

// Экран заказов (iikoFront): 3 режима просмотра, переключаются внизу справа —
// «Схема зала» (план столов по залам), «Все столы» (все залы сразу), «По официантам» (заказы по сотруднику).
// Свободный стол → ввод гостей → новый заказ. Занятый → открыть заказ.
type Mode = 'scheme' | 'all' | 'waiters'

export default function HallScreen() {
  const navigate = useNavigate()
  const { orders, startOrder, openExistingOrder, establishment } = usePos()
  const [hallId, setHallId] = useState(halls[0].id)
  const [mode, setMode] = useState<Mode>('scheme')
  const [guestTable, setGuestTable] = useState<Table | null>(null)

  // фастфуд — столов нет, на схему зала не пускаем
  useEffect(() => { if (establishment.mode === 'fastfood') navigate('/menu') }, [establishment.mode, navigate])

  const openOrderOnTable = (tableId: string) => orders.find((o) => o.tableId === tableId)
  const hallName = (id: string | null) => (id ? halls.find((h) => h.id === id)?.name ?? '' : '')

  const onTable = (t: Table) => {
    const existing = openOrderOnTable(t.id)
    if (existing) { openExistingOrder(existing.id); navigate('/order') }
    else setGuestTable(t)
  }
  const confirmGuests = (n: number) => {
    startOrder({ tableId: guestTable!.id, hallId: guestTable!.hallId, guests: n })
    setGuestTable(null)
    navigate('/order')
  }

  const TableTile = ({ t }: { t: Table }) => {
    const ord = openOrderOnTable(t.id)
    return (
      <button onClick={() => onTable(t)}
        className={`h-28 rounded-lg flex flex-col items-center justify-center gap-1 transition active:scale-95
          ${ord ? 'bg-pos-accent text-black' : 'bg-white/10 hover:bg-white/20'}`}>
        <div className="text-2xl font-bold">{t.no}</div>
        <div className="text-xs opacity-70">{t.seats} мест</div>
        {ord && <div className="text-xs font-semibold">{formatTenge(orderTotal(ord))}</div>}
      </button>
    )
  }
  const ModeBtn = ({ m, label }: { m: Mode; label: string }) => (
    <button onClick={() => setMode(m)}
      className={`h-9 px-4 rounded-md text-sm ${mode === m ? 'bg-pos-blue text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>
  )

  const waiters = Array.from(new Set(orders.map((o) => o.waiter))) // официанты с открытыми заказами

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Заказы" />
      <div className="flex-1 flex overflow-hidden">
        {/* список залов — только в режиме «Схема зала» */}
        {mode === 'scheme' && (
          <div className="w-44 bg-black/30 flex flex-col overflow-auto">
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
        )}

        <div className="flex-1 p-6 overflow-auto">
          {/* Схема зала — план столов выбранного зала */}
          {mode === 'scheme' && (
            <div className="grid grid-cols-3 gap-4 max-w-3xl">
              {tablesByHall(hallId).map((t) => <TableTile key={t.id} t={t} />)}
            </div>
          )}

          {/* Все столы — все залы сразу */}
          {mode === 'all' && (
            <div className="space-y-6">
              {halls.map((h) => (
                <div key={h.id}>
                  <div className="text-pos-accent text-sm uppercase mb-2">{h.name}</div>
                  <div className="grid grid-cols-4 gap-3 max-w-4xl">
                    {tablesByHall(h.id).map((t) => <TableTile key={t.id} t={t} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* По официантам — открытые заказы, сгруппированные по сотруднику */}
          {mode === 'waiters' && (
            waiters.length === 0 ? <div className="text-white/40">Нет открытых заказов</div> : (
              <div className="space-y-5 max-w-3xl">
                {waiters.map((w) => {
                  const ws = orders.filter((o) => o.waiter === w)
                  return (
                    <div key={w}>
                      <div className="text-pos-accent text-sm uppercase mb-2">{w} · заказов: {ws.length}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {ws.map((o) => (
                          <button key={o.id} onClick={() => { openExistingOrder(o.id); navigate('/order') }}
                            className="flex items-center justify-between h-14 px-4 rounded-md bg-white/5 hover:bg-white/10">
                            <span>{o.tableId ? `${hallName(o.hallId)}, стол ${findTable(o.tableId)?.no ?? ''}` : 'Быстрый чек'} · {o.guests} гост.</span>
                            <span className="font-semibold">{formatTenge(orderTotal(o))}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* нижняя панель: переключатель режимов (внизу справа, как в iikoFront) */}
      <div className="h-14 bg-white text-gray-700 flex items-center px-4 gap-3 shrink-0">
        <BackButton onClick={() => navigate('/menu')} />
        <div className="ml-auto flex items-center gap-2">
          <ModeBtn m="waiters" label="По официантам" />
          <ModeBtn m="all" label="Все столы" />
          <ModeBtn m="scheme" label="Схема зала" />
        </div>
      </div>

      {/* выбор количества гостей (1:1 с iikoFront) */}
      {guestTable && (
        <GuestCountModal onOk={confirmGuests} onCancel={() => setGuestTable(null)} />
      )}
    </div>
  )
}
