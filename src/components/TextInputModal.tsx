import { useState } from 'react'
import OnScreenKeyboard from './OnScreenKeyboard'

// Полноэкранный сенсорный ввод текста (FRONT_03) — 1:1 с iikoFront: заголовок поля,
// большое поле-дисплей с курсором, сенсорная клавиатура (ЙЦУКЕН/EN/Регистр), OK / Отмена.
// Тач-монитор (Electron-киоск) — ввод тапом, без системной клавиатуры ОС.
export default function TextInputModal({
  value,
  title,
  onOk,
  onCancel,
}: {
  value: string
  title: React.ReactNode
  onOk: (v: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(value)

  return (
    <div className="fixed inset-0 z-50 bg-[#3f4448] flex flex-col" onClick={onCancel}>
      <div className="text-center text-white/90 text-xl py-4 leading-tight whitespace-pre-line" onClick={(e) => e.stopPropagation()}>
        {title}
      </div>

      {/* поле-дисплей */}
      <div className="mx-4 flex-1 min-h-0 bg-white rounded p-4 text-2xl text-gray-800 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {text}
        <span className="inline-block w-0.5 h-7 -mb-1 bg-gray-800 animate-pulse" />
      </div>

      {/* клавиатура */}
      <div className="mx-4 mt-3" onClick={(e) => e.stopPropagation()}>
        <OnScreenKeyboard
          onKey={(ch) => setText((t) => t + ch)}
          onBackspace={() => setText((t) => t.slice(0, -1))}
          onClear={() => setText('')}
        />
      </div>

      {/* нижняя панель */}
      <div className="flex items-center justify-end gap-10 px-10 py-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onOk(text)} className="text-white text-xl font-semibold px-4">OK</button>
        <button onClick={onCancel} className="text-white text-xl px-4">Отмена</button>
      </div>
    </div>
  )
}
