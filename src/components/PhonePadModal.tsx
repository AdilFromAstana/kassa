import { useState } from 'react'
import { ChevronLeft, X } from 'lucide-react'

// Сенсорный ввод телефона (FRONT_03) — 1:1 с iikoFront: дисплей (по умолчанию «+7») +
// вертикальный numpad 1–9, ← (стереть), 0, ✕ (очистить), OK / Отмена.
// Тач-монитор (Electron-киоск) — ввод тапом, без системной клавиатуры.
const PREFIX = '+7'

export default function PhonePadModal({
  value,
  title = 'Телефон',
  onOk,
  onCancel,
}: {
  value: string
  title?: string
  onOk: (v: string) => void
  onCancel: () => void
}) {
  // храним только то, что идёт после префикса
  const init = (value || '').replace(/\s/g, '').replace(/^\+7/, '').replace(/\D/g, '')
  const [rest, setRest] = useState(init)

  const display = `${PREFIX}${rest ? ' ' + rest : ''}`
  const press = (d: string) => setRest((r) => (r.length >= 10 ? r : r + d))
  const back = () => setRest((r) => r.slice(0, -1))
  const clear = () => setRest('')

  const Key = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className="h-20 bg-white text-gray-800 text-4xl font-light flex items-center justify-center border border-gray-200 active:bg-pos-accent">
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#4a4f52] rounded-2xl shadow-2xl w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="text-center text-white/90 text-xl pt-5 pb-3 tracking-wide">{title}</div>

        {/* дисплей */}
        <div className="mx-4 h-20 bg-[#5a5f62] rounded flex items-center justify-end px-5 text-white text-4xl font-light">
          {display}
        </div>

        {/* numpad */}
        <div className="grid grid-cols-3 gap-px bg-gray-200 m-4 rounded overflow-hidden">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Key key={d} onClick={() => press(d)}>{d}</Key>
          ))}
          <Key onClick={back}><ChevronLeft size={32} /></Key>
          <Key onClick={() => press('0')}>0</Key>
          <Key onClick={clear}><X size={30} /></Key>
        </div>

        {/* нижняя панель */}
        <div className="bg-[#23262a] flex items-center justify-end gap-10 px-8 py-4">
          <button onClick={() => onOk(display)} className="text-white text-xl font-semibold px-4">OK</button>
          <button onClick={onCancel} className="text-white text-xl px-4">Отмена</button>
        </div>
      </div>
    </div>
  )
}
