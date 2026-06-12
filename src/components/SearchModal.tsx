import { useRef, useState } from 'react'
import { Ban, Search } from 'lucide-react'
import { usePos } from '../store/pos'
import { searchDishes } from '../mock/menu'
import { formatTenge } from '../lib/money'
import OnScreenKeyboard from './OnScreenKeyboard'
import type { Dish } from '../types'

interface Props { onPick: (d: Dish) => void; onClose: () => void }

// Полноэкранный «ПОИСК ТОВАРА» (iikoFront): результаты + сенсорная клавиатура.
// Ввод — через настоящий <input> (физическая клава, сканер ШК, IME) + сенсорная клавиатура append'ит в то же поле.
export default function SearchModal({ onPick, onClose }: Props) {
  const { stopList } = usePos()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const results = searchDishes(q)
  const focusInput = () => inputRef.current?.focus()

  return (
    <div className="absolute inset-0 bg-pos-bg/95 z-40 flex flex-col">
      <div className="text-center text-white/80 tracking-widest py-3">ПОИСК ТОВАРА</div>

      {/* строка ввода + результаты */}
      <div className="flex-1 overflow-auto px-6">
        <div className="max-w-2xl mx-auto">
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && results.length === 1 && !stopList.includes(results[0].id)) onPick(results[0])
            }}
            placeholder="введите название или код товара…"
            className="w-full h-12 bg-white rounded-md px-4 text-gray-800 text-lg mb-3 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            {q && results.length === 0 && <div className="text-white/50 col-span-2 py-4">Ничего не найдено</div>}
            {results.map((d) => {
              const stopped = stopList.includes(d.id)
              return (
                <button key={d.id} disabled={stopped} onClick={() => onPick(d)}
                  className={`flex items-center justify-between h-14 px-4 rounded-md text-left ${stopped ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-white text-gray-800 active:bg-gray-100'}`}>
                  <span><span className="font-mono text-xs text-gray-400 mr-3">{d.code}</span>{d.name}{stopped && <span className="text-pos-rose text-xs ml-2 inline-flex items-center gap-1"><Ban size={12} /> в стопе</span>}</span>
                  <span className="text-gray-600">{formatTenge(d.price)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* сенсорная клавиатура */}
      <div className="px-3 pb-2">
        <div className="max-w-4xl mx-auto">
          <OnScreenKeyboard
            onKey={(ch) => { setQ((s) => s + ch); focusInput() }}
            onBackspace={() => { setQ((s) => s.slice(0, -1)); focusInput() }}
            onClear={() => { setQ(''); focusInput() }}
          />
        </div>
      </div>

      {/* нижняя панель */}
      <div className="h-14 bg-[#1a1a1a] text-white flex items-center justify-end px-6 gap-6">
        <span className="mr-auto text-white/40 text-sm">Найдено: {results.length}</span>
        <button onClick={() => { if (results.length === 1 && !stopList.includes(results[0].id)) onPick(results[0]) }}
          className="flex flex-col items-center gap-1 text-xs"><Search size={18} />ПОИСК</button>
        <button onClick={onClose} className="h-10 px-8 rounded-md bg-gray-600">Отмена</button>
      </div>
    </div>
  )
}
