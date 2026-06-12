import { useState } from 'react'
import { Delete } from 'lucide-react'

interface Props {
  onKey: (ch: string) => void
  onBackspace: () => void
  onClear: () => void
  onEnter?: () => void
}

// Сенсорная клавиатура iikoFront: ЙЦУКЕН / EN, Регистр (shift), цифры, Стереть всё, пробел.
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']
const RU = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ё', 'ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.'],
]
const EN = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
]

export default function OnScreenKeyboard({ onKey, onBackspace, onClear, onEnter }: Props) {
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [shift, setShift] = useState(false)
  const rows = lang === 'ru' ? RU : EN

  const press = (ch: string) => {
    onKey(shift ? ch.toUpperCase() : ch)
    if (shift) setShift(false)
  }

  const Key = ({ ch, w = 'flex-1', label }: { ch?: string; w?: string; label?: React.ReactNode }) => (
    <button
      onClick={() => (ch != null ? press(ch) : undefined)}
      className={`${w} h-12 m-0.5 rounded bg-white border border-gray-300 text-gray-800 text-lg active:bg-gray-200 select-none`}>
      {label ?? (shift && ch ? ch.toUpperCase() : ch)}
    </button>
  )

  return (
    <div className="bg-gray-100 p-2 rounded-lg select-none">
      <div className="flex">
        {DIGITS.map((d) => <Key key={d} ch={d} />)}
        <button onClick={onBackspace} className="flex-[1.6] h-12 m-0.5 rounded bg-gray-300 text-gray-800 flex items-center justify-center active:bg-gray-400"><Delete size={20} /></button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center">
          {row.map((ch) => <Key key={ch} ch={ch} />)}
        </div>
      ))}
      <div className="flex">
        <button onClick={() => setShift((s) => !s)}
          className={`flex-[1.4] h-12 m-0.5 rounded border border-gray-300 text-sm ${shift ? 'bg-pos-accent text-black' : 'bg-white text-gray-700'}`}>Регистр</button>
        <button onClick={() => setLang((l) => (l === 'ru' ? 'en' : 'ru'))}
          className="flex-1 h-12 m-0.5 rounded bg-white border border-gray-300 text-sm text-gray-700">{lang === 'ru' ? 'EN' : 'РУ'}</button>
        <button onClick={() => press(' ')} className="flex-[5] h-12 m-0.5 rounded bg-white border border-gray-300">пробел</button>
        <button onClick={onClear} className="flex-[1.6] h-12 m-0.5 rounded bg-white border border-gray-300 text-sm text-gray-700">Стереть всё</button>
        {onEnter && <button onClick={onEnter} className="flex-[1.4] h-12 m-0.5 rounded bg-pos-green text-white text-sm">Ввод</button>}
      </div>
    </div>
  )
}
