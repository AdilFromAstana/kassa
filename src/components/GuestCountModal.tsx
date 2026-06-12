import { useState } from 'react'
import { X } from 'lucide-react'

// Выбор количества гостей (FRONT_03) — 1:1 с iikoFront.
// Режим «быстрый»: грид 1–8 + «…» (тап 1–8 = сразу выбор; «…» → numpad). Низ: Отмена.
// Режим «numpad»: дисплей + 1–9, 0, ✕ (очистить), низ: OK · Отмена. Тач-монитор (Electron-киоск).
export default function GuestCountModal({
  value,
  onOk,
  onCancel,
}: {
  value?: number
  onOk: (n: number) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'quick' | 'pad'>('quick')
  const [entry, setEntry] = useState(value ? String(value) : '')

  const Cell = ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}
      className="h-28 bg-white text-gray-800 text-5xl font-light flex items-center justify-center border border-gray-200 active:bg-pos-accent disabled:opacity-0">
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#4a4f52] rounded-xl shadow-2xl w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="text-center text-white/90 text-xl py-4">Укажите количество гостей</div>

        {mode === 'quick' ? (
          <>
            <div className="grid grid-cols-3 gap-px bg-gray-200">
              {['1', '2', '3', '4', '5', '6', '7', '8'].map((d) => (
                <Cell key={d} onClick={() => onOk(parseInt(d, 10))}>{d}</Cell>
              ))}
              <Cell onClick={() => { setMode('pad'); setEntry('') }}>…</Cell>
            </div>
            <div className="bg-[#23262a] text-center py-4">
              <button onClick={onCancel} className="text-white text-xl font-semibold">Отмена</button>
            </div>
          </>
        ) : (
          <>
            {/* дисплей */}
            <div className="h-16 px-6 flex items-center justify-end text-white text-5xl font-semibold">{entry || '0'}</div>
            <div className="grid grid-cols-3 gap-px bg-gray-200">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <Cell key={d} onClick={() => setEntry((e) => (e.length >= 3 ? e : e + d))}>{d}</Cell>
              ))}
              <Cell disabled />
              <Cell onClick={() => setEntry((e) => (e.length >= 3 ? e : e + '0'))}>0</Cell>
              <Cell onClick={() => setEntry('')}><X size={34} /></Cell>
            </div>
            <div className="bg-[#23262a] flex items-center justify-around py-4">
              <button onClick={() => onOk(Math.max(1, parseInt(entry || '1', 10)))} className="text-white text-xl font-semibold px-6">OK</button>
              <button onClick={onCancel} className="text-white text-xl px-6">Отмена</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
