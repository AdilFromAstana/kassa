import { useState } from 'react'
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { halls, tablesByHall } from '../mock/data'

// Выбор даты и резервируемого стола (FRONT_03 §4) — 1:1 с iikoFront: дата ‹ › сверху,
// строки залов (индекс + имя зала) с плитками номеров столов, низ: Цвет стола · Выбрать несколько · Отмена.
export default function TableSelectModal({
  hallId,
  tableId,
  onPick,
  onCancel,
}: {
  hallId: string | null
  tableId: string | null
  onPick: (hallId: string, tableId: string) => void
  onCancel: () => void
}) {
  const [day, setDay] = useState(10) // мок-день; стрелки листают дату

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex" onClick={onCancel}>
      <div className="m-auto w-[94%] h-[92%] bg-[#5a5f62] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* заголовок + дата */}
        <div className="text-center text-white/90 text-xl pt-5 tracking-wide">ВЫБЕРИТЕ ДАТУ И РЕЗЕРВИРУЕМЫЙ СТОЛ</div>
        <div className="flex items-center justify-center gap-10 py-4">
          <button onClick={() => setDay((d) => Math.max(1, d - 1))} className="text-white/80"><ChevronLeft size={34} /></button>
          <div className="text-pos-accent text-2xl font-semibold">{day} июня 2026</div>
          <button onClick={() => setDay((d) => d + 1)} className="text-white"><ChevronRight size={34} /></button>
        </div>

        {/* залы + столы */}
        <div className="flex-1 overflow-auto px-6 pb-4 space-y-px">
          {halls.map((h, idx) => (
            <div key={h.id} className="flex items-start">
              {/* левая ячейка зала */}
              <div className="flex shrink-0">
                <div className="w-14 h-20 bg-white text-gray-800 flex items-center justify-center text-lg border border-gray-300">{idx}</div>
                <div className={`w-56 h-20 flex items-center px-4 border border-gray-300 ${hallId === h.id ? 'bg-pos-accent text-gray-900' : 'bg-white text-gray-800'}`}>{h.name}</div>
              </div>
              {/* плитки столов */}
              <div className="flex flex-wrap gap-2 ml-2">
                {tablesByHall(h.id).map((t) => {
                  const sel = hallId === h.id && tableId === t.id
                  return (
                    <button key={t.id} onClick={() => onPick(h.id, t.id)}
                      className={`w-20 h-20 rounded text-2xl flex items-center justify-center border ${sel ? 'bg-pos-accent text-gray-900 border-pos-accent' : 'bg-[#4a4f52] text-white border-white/40 active:bg-white/10'}`}>
                      {t.no}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* нижняя панель */}
        <div className="bg-[#23262a] flex items-center px-8 py-4 gap-8">
          <button className="flex flex-col items-center gap-0.5 text-[11px] text-white/80"><Lightbulb size={22} />ЦВЕТ СТОЛА</button>
          <button className="text-white text-lg font-semibold">Выбрать несколько</button>
          <button onClick={onCancel} className="ml-auto text-white text-xl">Отмена</button>
        </div>
      </div>
    </div>
  )
}
