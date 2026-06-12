import { useState } from 'react'
import { X } from 'lucide-react'

// Ввод количества позиции (FRONT_03) — 1:1 с iikoFront: заголовок «Количество» + имя блюда,
// дисплей (значение + единица), numpad 1–9 / , / 0 / ✕, колонка быстрых дробей, OK · Отмена.
// Тач-монитор (Electron-киоск) — ввод тапом.
const FRACTIONS = [
  ['0,25', '0,33'],
  ['0,5', '0,75'],
  ['1,25', '1,33'],
  ['1,5', '1,75'],
]

export default function QuantityModal({
  dishName,
  unit = 'ШТ',
  value,
  onOk,
  onCancel,
}: {
  dishName: string
  unit?: string
  value: number
  onOk: (n: number) => void
  onCancel: () => void
}) {
  const fmt = (n: number) => String(n).replace('.', ',')
  const [entry, setEntry] = useState(fmt(value))
  const [fresh, setFresh] = useState(true) // первый ввод заменяет исходное значение

  const num = parseFloat((entry || '0').replace(',', '.')) || 0

  const digit = (d: string) => {
    setEntry((e) => {
      if (fresh) { setFresh(false); return d }
      if (e.length >= 6) return e
      return e === '0' ? d : e + d
    })
  }
  const comma = () => setEntry((e) => { setFresh(false); return e.includes(',') ? e : (e || '0') + ',' })
  const clear = () => { setEntry(''); setFresh(false) }
  const setFrac = (f: string) => { setEntry(f); setFresh(false) }

  const Key = ({ children, onClick, kind = 'num' }: { children?: React.ReactNode; onClick?: () => void; kind?: 'num' | 'frac' }) => (
    <button onClick={onClick}
      className={`h-24 flex items-center justify-center text-4xl font-light border border-gray-200 active:bg-pos-accent
        ${kind === 'frac' ? 'bg-[#e9e6f2] text-gray-700 text-2xl' : 'bg-white text-gray-800'}`}>
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#4a4f52] rounded-xl shadow-2xl w-[620px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="text-center text-white/90 text-xl pt-4">Количество</div>
        <div className="text-center text-white/60 text-base pb-3 px-4 truncate">{dishName}</div>

        {/* дисплей: значение | единица */}
        <div className="flex">
          <div className="flex-1 h-16 bg-[#5a5f62] text-white text-3xl flex items-center justify-center">{entry || '0'}</div>
          <div className="w-40 h-16 bg-[#2a2d30] text-white text-2xl flex items-center justify-center">{unit}</div>
        </div>

        {/* numpad (3 кол.) + дроби (2 кол.) */}
        <div className="grid grid-cols-5 gap-px bg-gray-200">
          <Key onClick={() => digit('1')}>1</Key><Key onClick={() => digit('2')}>2</Key><Key onClick={() => digit('3')}>3</Key>
          <Key kind="frac" onClick={() => setFrac(FRACTIONS[0][0])}>{FRACTIONS[0][0]}</Key><Key kind="frac" onClick={() => setFrac(FRACTIONS[0][1])}>{FRACTIONS[0][1]}</Key>

          <Key onClick={() => digit('4')}>4</Key><Key onClick={() => digit('5')}>5</Key><Key onClick={() => digit('6')}>6</Key>
          <Key kind="frac" onClick={() => setFrac(FRACTIONS[1][0])}>{FRACTIONS[1][0]}</Key><Key kind="frac" onClick={() => setFrac(FRACTIONS[1][1])}>{FRACTIONS[1][1]}</Key>

          <Key onClick={() => digit('7')}>7</Key><Key onClick={() => digit('8')}>8</Key><Key onClick={() => digit('9')}>9</Key>
          <Key kind="frac" onClick={() => setFrac(FRACTIONS[2][0])}>{FRACTIONS[2][0]}</Key><Key kind="frac" onClick={() => setFrac(FRACTIONS[2][1])}>{FRACTIONS[2][1]}</Key>

          <Key onClick={comma}>,</Key><Key onClick={() => digit('0')}>0</Key><Key onClick={clear}><X size={30} /></Key>
          <Key kind="frac" onClick={() => setFrac(FRACTIONS[3][0])}>{FRACTIONS[3][0]}</Key><Key kind="frac" onClick={() => setFrac(FRACTIONS[3][1])}>{FRACTIONS[3][1]}</Key>
        </div>

        <div className="bg-[#23262a] flex items-center justify-center gap-24 py-4">
          <button onClick={() => onOk(num > 0 ? num : value)} className="text-white text-xl font-semibold px-6">OK</button>
          <button onClick={onCancel} className="text-white text-xl px-6">Отмена</button>
        </div>
      </div>
    </div>
  )
}
