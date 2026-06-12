import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

// Сенсорный пикер времени (FRONT_03) — 1:1 с iikoFront: цифры ЧЧ:ММ + стрелки + цифровая
// панель + «По умолчанию» / OK / Отмена. Рассчитан на тач-монитор (Electron-киоск) —
// ввод тапом по цифрам, а не через системный input/клавиатуру ОС.
export default function TimePickerModal({
  value,
  defaultValue = '19:00',
  onOk,
  onCancel,
}: {
  value: string
  defaultValue?: string
  onOk: (v: string) => void
  onCancel: () => void
}) {
  const parse = (v: string) => {
    const [h = '00', m = '00'] = v.split(':')
    return [h.padStart(2, '0').slice(0, 2), m.padStart(2, '0').slice(0, 2)] as [string, string]
  }
  const [[h, m], setHM] = useState<[string, string]>(parse(value))
  const [active, setActive] = useState(0) // 0,1 = часы; 2,3 = минуты

  const digits = [h[0], h[1], m[0], m[1]]

  const clampH = (n: number) => ((n % 24) + 24) % 24
  const clampM = (n: number) => ((n % 60) + 60) % 60
  const setH = (n: number) => setHM([String(clampH(n)).padStart(2, '0'), m])
  const setM = (n: number) => setHM([h, String(clampM(n)).padStart(2, '0')])

  const press = (d: string) => {
    const next = [...digits]
    next[active] = d
    let nh = (next[0] + next[1])
    let nm = (next[2] + next[3])
    // не даём выйти за пределы при наборе
    if (parseInt(nh, 10) > 23) nh = '23'
    if (parseInt(nm, 10) > 59) nm = '59'
    setHM([nh, nm])
    setActive((a) => (a >= 3 ? 3 : a + 1))
  }

  const Cell = ({ idx, ch }: { idx: number; ch: string }) => (
    <button
      onClick={() => setActive(idx)}
      className={`w-16 h-20 rounded text-5xl font-light flex items-center justify-center ${
        active === idx ? 'bg-pos-accent text-gray-900' : 'bg-white text-gray-800'
      }`}
    >
      {ch}
    </button>
  )
  const Arrow = ({ onClick, dir }: { onClick: () => void; dir: 'up' | 'down' }) => (
    <button onClick={onClick} className="w-12 h-12 flex items-center justify-center text-white/80 hover:text-white">
      {dir === 'up' ? <ChevronUp size={40} /> : <ChevronDown size={40} />}
    </button>
  )
  const Key = ({ d }: { d: string }) => (
    <button onClick={() => press(d)} className="w-20 h-20 rounded bg-white text-gray-800 text-4xl font-light active:bg-pos-accent">
      {d}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-[#4a4f52] rounded-2xl shadow-2xl w-[860px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="text-center text-white/90 text-xl pt-6 pb-2 tracking-wide">ВРЕМЯ (ЧЧ:ММ)</div>

        <div className="flex items-center justify-center gap-6 px-8 py-8">
          {/* стрелки часов */}
          <div className="flex flex-col gap-3">
            <Arrow dir="up" onClick={() => setH(parseInt(h, 10) + 1)} />
            <Arrow dir="down" onClick={() => setH(parseInt(h, 10) - 1)} />
          </div>
          {/* ЧЧ : ММ */}
          <div className="flex items-center gap-2">
            <Cell idx={0} ch={digits[0]} />
            <Cell idx={1} ch={digits[1]} />
            <div className="text-5xl text-white px-1">:</div>
            <Cell idx={2} ch={digits[2]} />
            <Cell idx={3} ch={digits[3]} />
          </div>
          {/* стрелки минут */}
          <div className="flex flex-col gap-3">
            <Arrow dir="up" onClick={() => setM(parseInt(m, 10) + 1)} />
            <Arrow dir="down" onClick={() => setM(parseInt(m, 10) - 1)} />
          </div>

          {/* цифровая панель */}
          <div className="ml-6 grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} d={d} />)}
            <div />
            <Key d="0" />
            <div />
          </div>
        </div>

        {/* нижняя панель */}
        <div className="bg-[#23262a] flex items-center px-8 py-4">
          <button onClick={() => setHM(parse(defaultValue))} className="text-white/80 text-lg hover:text-white">
            По умолчанию
          </button>
          <div className="ml-auto flex items-center gap-10">
            <button onClick={() => onOk(`${h}:${m}`)} className="text-white text-xl font-semibold px-4">OK</button>
            <button onClick={onCancel} className="text-white text-xl px-4">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  )
}
