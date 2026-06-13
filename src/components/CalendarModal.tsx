import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// Сенсорный календарь (FRONT_03) — 1:1 с iikoFront: «‹ Месяц Год ›», сетка Пн–Вс,
// выбранный день жёлтый, дни соседних месяцев приглушены. Снизу «Сегодня / ОК / Отмена».
// Рассчитан на тач-монитор (Electron-киоск), а не на системный date input.
export default function CalendarModal({
  value,
  onOk,
  onCancel,
}: {
  value: Date
  onOk: (d: Date) => void
  onCancel: () => void
}) {
  const [sel, setSel] = useState<Date>(value)
  const [view, setView] = useState<Date>(new Date(value.getFullYear(), value.getMonth(), 1))

  const y = view.getFullYear()
  const mo = view.getMonth()
  // понедельник-первый: смещение первого дня месяца (0 = Пн … 6 = Вс)
  const startOffset = (new Date(y, mo, 1).getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => new Date(y, mo, 1 - startOffset + i))

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#4a4f52] rounded-lg shadow-2xl w-[680px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* шапка месяца */}
        <div className="flex items-center justify-between px-6 py-4 text-white">
          <button onClick={() => setView(new Date(y, mo - 1, 1))} className="p-2 hover:text-pos-accent"><ChevronLeft size={32} /></button>
          <div className="text-xl tracking-wide">{MONTHS_NOM[mo]} {y}</div>
          <button onClick={() => setView(new Date(y, mo + 1, 1))} className="p-2 hover:text-pos-accent"><ChevronRight size={32} /></button>
        </div>

        {/* дни недели */}
        <div className="grid grid-cols-7 px-3 text-white/70 text-sm">
          {WEEK.map((w) => <div key={w} className="text-center py-1">{w}</div>)}
        </div>

        {/* сетка дат */}
        <div className="grid grid-cols-7 gap-px bg-white/10 px-3 pb-3">
          {days.map((d, i) => {
            const inMonth = d.getMonth() === mo
            const isSel = sameDay(d, sel)
            return (
              <button
                key={i}
                onClick={() => setSel(d)}
                className={`h-16 flex items-center justify-center text-lg border border-gray-300
                  ${isSel ? 'bg-pos-accent text-gray-900 font-bold'
                    : inMonth ? 'bg-white text-gray-800' : 'bg-gray-200 text-gray-400'}`}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>

        {/* нижняя панель */}
        <div className="bg-[#23262a] flex items-center px-6 py-4">
          <button
            onClick={() => { const t = new Date(); setView(new Date(t.getFullYear(), t.getMonth(), 1)); setSel(t) }}
            className="text-white/80 text-lg hover:text-white"
          >
            Сегодня
          </button>
          <div className="ml-auto flex items-center gap-10">
            <button onClick={() => onOk(sel)} className="text-white text-xl font-semibold px-4">ОК</button>
            <button onClick={onCancel} className="text-white text-xl px-4">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  )
}
