import { useState } from 'react'
import Modal from './Modal'

// Универсальная тач-модалка ввода (замена window.prompt — правило проекта: тач-модалки, не prompt).
// 1–2 поля (текст/число), Enter и кнопка OK подтверждают. Поверх оболочки Modal.
export interface InputField { key: string; label: string; type?: 'text' | 'number'; placeholder?: string; default?: string }

export default function InputModal({ title, desc, fields, okLabel = 'OK', onOk, onCancel }: {
  title: string
  desc?: string
  fields: InputField[]
  okLabel?: string
  onOk: (values: Record<string, string>) => void
  onCancel: () => void
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.default ?? ''])))
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }))

  return (
    <Modal onClose={onCancel} z="z-[60]" className="p-5">
      <form onSubmit={(e) => { e.preventDefault(); onOk(vals) }}>
        <div className="text-lg font-semibold mb-1">{title}</div>
        {desc && <div className="text-sm text-gray-500 mb-3">{desc}</div>}
        <div className="flex flex-col gap-3 mb-4">
          {fields.map((f, i) => (
            <label key={f.key} className="flex flex-col text-xs text-gray-500">{f.label}
              <input autoFocus={i === 0} value={vals[f.key]} onChange={(e) => set(f.key, e.target.value)}
                inputMode={f.type === 'number' ? 'decimal' : undefined} placeholder={f.placeholder}
                className="mt-1 h-11 rounded-md border border-gray-300 px-3 text-base outline-none focus:border-pos-blue" />
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="h-11 px-5 rounded-md border border-gray-300 hover:bg-gray-100">Отмена</button>
          <button type="submit" className="h-11 px-6 rounded-md bg-pos-blue text-white">{okLabel}</button>
        </div>
      </form>
    </Modal>
  )
}
