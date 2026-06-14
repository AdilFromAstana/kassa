import type { ReactNode } from 'react'

// Панель вкладок (подчёркивание активной) — единый стиль для разделов офиса.
// Заменяет копипасту `border-b-2`-кнопок в OfficeScreen/Corp/Ledger/Loyalty/Delivery.
export interface TabItem<T extends string> { id: T; label: string; icon?: ReactNode }

export default function Tabs<T extends string>({ items, active, onChange, right, compact }: {
  items: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  right?: ReactNode      // доп. кнопки справа в той же строке (напр. «Excel…», «Выгрузить в 1С»)
  compact?: boolean      // h-9 вместо h-10
}) {
  return (
    <div className="flex gap-1 mb-4 border-b border-gray-200">
      {items.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 ${compact ? 'h-9' : 'h-10'} text-sm -mb-px border-b-2 flex items-center gap-1.5 ${active === t.id ? 'border-emerald-500 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          {t.icon}{t.label}
        </button>
      ))}
      {right}
    </div>
  )
}
