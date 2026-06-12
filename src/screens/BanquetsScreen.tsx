import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Lock, ChevronLeft, ChevronRight, ChevronsUp, Keyboard, X, CalendarClock, Utensils, LayoutGrid } from 'lucide-react'
import { usePos } from '../store/pos'
import { findTable, halls } from '../mock/data'

// Банкеты и резервы (FRONT_03 §4) — 1:1 с iikoFront: жёлтые фильтры, полоса даты, колонки, нижняя панель.
const GRID = 'grid grid-cols-[90px_130px_150px_160px_80px_minmax(170px,1fr)_minmax(140px,1fr)_auto] gap-2 items-center'
const DAYS = ['Сегодня', 'Завтра']

export default function BanquetsScreen() {
  const navigate = useNavigate()
  const { banquets, setBanquetStatus, logout } = usePos()
  const [showBanket, setShowBanket] = useState(true)
  const [showReserv, setShowReserv] = useState(true)
  const [onlyActive, setOnlyActive] = useState(true)
  const [dateMode, setDateMode] = useState<'date' | 'period'>('date')
  const [dayIdx, setDayIdx] = useState(0)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const hallName = (id: string) => halls.find((h) => h.id === id)?.name ?? id
  const tableNo = (id: string) => findTable(id)?.no ?? id

  const rows = banquets
    .filter((r) => (r.type === 'Банкет' ? showBanket : showReserv))
    .filter((r) => !onlyActive || r.status !== 'Снят')
    .filter((r) => dateMode === 'period' || r.date === DAYS[dayIdx])
    .filter((r) => !q || (r.clientName + r.clientPhone + r.comment).toLowerCase().includes(q.toLowerCase()))

  const Chip = ({ on, set, label }: { on: boolean; set: () => void; label: string }) => (
    <button onClick={set} className={`px-6 h-12 font-semibold border-r border-black/15 ${on ? 'bg-pos-accent text-gray-900' : 'bg-white/80 text-gray-500'}`}>{label}</button>
  )
  const NavBtn = ({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-0.5 text-[11px] px-3 active:scale-95">{icon}{label}</button>
  )

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      {/* ВЕРХ: жёлтая панель фильтров + меню/замок */}
      <div className="flex items-stretch h-12 shrink-0">
        <Chip on={showBanket} set={() => setShowBanket((v) => !v)} label="Банкет" />
        <Chip on={showReserv} set={() => setShowReserv((v) => !v)} label="Резерв" />
        <Chip on={onlyActive} set={() => setOnlyActive((v) => !v)} label="Только активные" />
        <div className="flex-1 bg-white" />
        <div className="flex items-center gap-4 px-4 bg-white text-gray-700">
          <button onClick={() => navigate('/menu')} title="Доп. меню"><Menu size={22} /></button>
          <button onClick={() => { logout(); navigate('/') }} title="Заблокировать"><Lock size={18} /></button>
        </div>
      </div>

      {/* серо-голубая полоса: Дата|Период + навигация по дате */}
      <div className="bg-[#8a99a6] text-white shrink-0">
        <div className="flex items-center px-4 h-12 gap-6">
          <button onClick={() => setDateMode('date')} className={`text-lg ${dateMode === 'date' ? 'font-semibold underline underline-offset-4' : 'opacity-70'}`}>Дата</button>
          <button onClick={() => setDateMode('period')} className={`text-lg ${dateMode === 'period' ? 'font-semibold underline underline-offset-4' : 'opacity-70'}`}>Период</button>
          <div className="mx-auto flex items-center gap-6">
            <button onClick={() => setDayIdx((i) => Math.max(0, i - 1))} disabled={dateMode === 'period'} className="disabled:opacity-30"><ChevronLeft size={28} /></button>
            <div className="text-center leading-tight">
              <div className="text-xl font-semibold">{dateMode === 'period' ? 'Все даты' : DAYS[dayIdx]}</div>
              <div className="text-xs opacity-80">{dateMode === 'period' ? 'период' : '(текущий день)'}</div>
            </div>
            <button onClick={() => setDayIdx((i) => Math.min(DAYS.length - 1, i + 1))} disabled={dateMode === 'period'} className="disabled:opacity-30"><ChevronRight size={28} /></button>
          </div>
        </div>
        {/* заголовки колонок */}
        <div className={`${GRID} px-4 py-2 text-sm border-t border-white/25`}>
          <div className="flex items-center gap-1">Тип <span className="text-xs">▲</span></div>
          <div>Статус</div><div>Время</div><div>Залы, столы</div><div>Гостей</div><div>Клиент</div><div>Коммент.</div><div />
        </div>
      </div>

      {/* список */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 && <div className="text-white/40 text-center mt-10">Нет записей на выбранную дату</div>}
        {rows.map((r) => (
          <div key={r.id} className={`${GRID} px-4 py-2 border-b border-white/10 ${r.status === 'Снят' ? 'opacity-40 line-through' : ''}`}>
            <div>{r.type}</div>
            <div>{r.status}</div>
            <div>{r.date} {r.time}</div>
            <div>{hallName(r.hallId)}, {tableNo(r.tableId)}</div>
            <div>{r.guests}</div>
            <div>{r.clientName}<div className="text-xs text-white/40">{r.clientPhone}</div></div>
            <div>{r.comment}</div>
            <div className="flex gap-1 justify-end">
              {r.status === 'Действует' && (
                <>
                  <button onClick={() => setBanquetStatus(r.id, 'Гость пришёл')} className="text-xs bg-pos-green px-2 py-1 rounded">Пришёл</button>
                  <button onClick={() => setBanquetStatus(r.id, 'Снят')} className="text-xs bg-pos-rose text-gray-900 px-2 py-1 rounded">Снять</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* нижняя панель: назад · поиск · действия */}
      <div className="h-20 bg-[#1a1a1a] flex items-center px-4 gap-3 shrink-0">
        <NavBtn onClick={() => navigate('/menu')} icon={<ChevronLeft size={24} />} label="НАЗАД" />
        <button onClick={() => inputRef.current?.focus()} className="h-12 w-14 rounded bg-pos-accent text-gray-900 flex items-center justify-center"><Keyboard size={22} /></button>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по клиенту/комментарию"
          className="h-12 w-72 rounded px-3 text-gray-800 outline-none" />
        <button onClick={() => setQ('')} className="h-12 w-12 rounded bg-white/10 flex items-center justify-center"><X size={20} /></button>
        <button className="h-12 w-12 rounded bg-white/10 flex items-center justify-center" title="Свернуть"><ChevronsUp size={20} /></button>
        <div className="ml-auto flex items-center gap-2">
          <NavBtn onClick={() => navigate('/banquet/new?type=Резерв')} icon={<CalendarClock size={22} />} label="НОВЫЙ РЕЗЕРВ" />
          <NavBtn onClick={() => navigate('/banquet/new?type=Банкет')} icon={<Utensils size={22} />} label="НОВЫЙ БАНКЕТ" />
          <NavBtn onClick={() => navigate('/halls')} icon={<LayoutGrid size={22} />} label="СХЕМА ЗАЛА" />
        </div>
      </div>
    </div>
  )
}
