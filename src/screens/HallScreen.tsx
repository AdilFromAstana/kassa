import { useEffect, useRef, useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, orderTotal } from '../store/pos'
import { halls, tablesByHall, findTable } from '../mock/data'
import { formatTenge } from '../lib/money'
import { minutesSince } from '../lib/date'
import TopBar from '../components/TopBar'
import GuestCountModal from '../components/GuestCountModal'
import type { Table, Order } from '../types'

// Экран заказов (iikoFront): 3 режима просмотра, переключаются внизу справа —
// «Схема зала» (план столов: произвольное расположение, перетаскивание, форма по числу мест),
// «Все столы» (все залы сеткой), «По официантам» (заказы по сотруднику).
// Свободный стол → ввод гостей → новый заказ. Занятый → открыть заказ.
type Mode = 'scheme' | 'all' | 'waiters'
type Pos = { x: number; y: number }

const CELL = 150 // шаг сетки координат стола → пиксели на плане
const LAYOUT_KEY = 'iiko-hall-layout'

function loadLayout(): Record<string, Pos> {
  try { const raw = localStorage.getItem(LAYOUT_KEY); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return {}
}

// цвет занятости по времени с открытия заказа (норматив обслуживания)
function busyColor(mins: number): string {
  if (mins < 20) return 'bg-pos-green text-black border-black/20'
  if (mins < 45) return 'bg-pos-accent text-black border-black/20'
  return 'bg-pos-rose text-black border-black/20'
}

// форма/размер стола по количеству мест (как на плане iikoFront)
function tableShape(seats: number) {
  if (seats <= 1) return { w: 70, h: 70, round: 'rounded-full' }
  if (seats <= 2) return { w: 96, h: 96, round: 'rounded-full' }
  if (seats <= 4) return { w: 120, h: 96, round: 'rounded-xl' }
  return { w: 150, h: 110, round: 'rounded-xl' }
}

// занятый стол: сумма + время + официант
function BusyInfo({ ord }: { ord: Order }) {
  const mins = minutesSince(ord.openedAt)
  return (
    <>
      <div className="text-sm font-bold leading-none">{formatTenge(orderTotal(ord))}</div>
      <div className="text-[10px] leading-tight opacity-80">{ord.openedAt} · {mins}м</div>
      <div className="text-[10px] leading-tight opacity-70 truncate max-w-full px-1">{ord.waiter}</div>
    </>
  )
}

// Стол на схеме зала: абсолютная позиция, перетаскивание в режиме правки (drag локальный, коммит на отпускании).
function DraggableTable({ t, base, editLayout, order, onOpen, onCommit }: {
  t: Table; base: Pos; editLayout: boolean; order?: Order; onOpen: () => void; onCommit: (p: Pos) => void
}) {
  const [pos, setPos] = useState<Pos>(base)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  // синхронизировать позицию при внешних изменениях плана (если не тащим прямо сейчас)
  useEffect(() => { if (!drag.current) setPos(base) }, [base.x, base.y]) // eslint-disable-line react-hooks/exhaustive-deps

  const { w, h, round } = tableShape(t.seats)
  const mins = order ? minutesSince(order.openedAt) : 0

  const onDown = (e: React.PointerEvent) => {
    if (!editLayout) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.sx
    const dy = e.clientY - drag.current.sy
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true
    setPos({ x: Math.max(0, drag.current.ox + dx), y: Math.max(0, drag.current.oy + dy) })
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) { if (!editLayout) onOpen(); return }
    if (d.moved) onCommit(pos)
    else if (!editLayout) onOpen()
  }

  return (
    <button
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{ left: pos.x, top: pos.y, width: w, height: h }}
      className={`absolute flex flex-col items-center justify-center gap-0.5 border-2 transition active:scale-[0.98] ${round}
        ${editLayout ? 'cursor-move ring-2 ring-pos-blue/60' : 'cursor-pointer'}
        ${order ? busyColor(mins) : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'}`}>
      <div className="text-xl font-bold leading-none">{t.no}</div>
      {order ? <BusyInfo ord={order} /> : <div className="text-[10px] opacity-60">{t.seats} мест</div>}
    </button>
  )
}

export default function HallScreen() {
  const navigate = useNavigate()
  const { orders, startOrder, openExistingOrder, establishment } = usePos()
  const [hallId, setHallId] = useState(halls[0].id)
  const [mode, setMode] = useState<Mode>('scheme')
  const [guestTable, setGuestTable] = useState<Table | null>(null)
  const [layout, setLayout] = useState<Record<string, Pos>>(loadLayout)
  const [editLayout, setEditLayout] = useState(false)

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

  const posOf = (t: Table): Pos => layout[t.id] ?? { x: t.x * CELL, y: t.y * CELL }
  const commitPos = (id: string, p: Pos) => {
    const next = { ...layout, [id]: p }
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  // плитка стола (режим «Все столы»)
  const TableTile = ({ t }: { t: Table }) => {
    const ord = openOrderOnTable(t.id)
    const mins = ord ? minutesSince(ord.openedAt) : 0
    return (
      <button onClick={() => onTable(t)}
        className={`h-28 rounded-lg flex flex-col items-center justify-center gap-0.5 transition active:scale-95 border-2 border-transparent
          ${ord ? busyColor(mins) : 'bg-white/10 hover:bg-white/20'}`}>
        <div className="text-2xl font-bold leading-none">{t.no}</div>
        <div className="text-xs opacity-70">{t.seats} мест</div>
        {ord && <BusyInfo ord={ord} />}
      </button>
    )
  }

  const ModeBtn = ({ m, label }: { m: Mode; label: string }) => (
    <button onClick={() => setMode(m)}
      className={`h-9 px-4 rounded-md text-sm ${mode === m ? 'bg-pos-blue text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>
  )

  const waiters = Array.from(new Set(orders.map((o) => o.waiter))) // официанты с открытыми заказами

  // размер холста схемы — по самой дальней позиции стола
  const planTables = tablesByHall(hallId)
  const planW = Math.max(640, ...planTables.map((t) => posOf(t).x + 170))
  const planH = Math.max(360, ...planTables.map((t) => posOf(t).y + 130))

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
            <button onClick={() => setEditLayout((v) => !v)}
              className={`mt-auto h-12 text-sm border-t border-white/10 ${editLayout ? 'bg-pos-blue text-white' : 'hover:bg-white/5 text-white/70'}`}>
              {editLayout ? '✓ Готово' : '✎ Редактировать план'}
            </button>
          </div>
        )}

        <div className="flex-1 p-6 overflow-auto">
          {/* Схема зала — план столов выбранного зала (произвольное расположение) */}
          {mode === 'scheme' && (
            <>
              {editLayout && <div className="text-pos-accent text-sm mb-3">Перетаскивайте столы, чтобы изменить план. План сохраняется на этом терминале.</div>}
              <div className="relative bg-black/20 rounded-lg border border-white/10" style={{ width: planW, height: planH }}>
                {planTables.map((t) => (
                  <DraggableTable key={t.id} t={t} base={posOf(t)} editLayout={editLayout}
                    order={openOrderOnTable(t.id)} onOpen={() => onTable(t)} onCommit={(p) => commitPos(t.id, p)} />
                ))}
              </div>
              {/* легенда занятости */}
              <div className="flex items-center gap-4 mt-4 text-xs text-white/60">
                <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-white/20 inline-block" />свободен</span>
                <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-pos-green inline-block" />&lt; 20 мин</span>
                <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-pos-accent inline-block" />20–45 мин</span>
                <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-pos-rose inline-block" />&gt; 45 мин</span>
              </div>
            </>
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
