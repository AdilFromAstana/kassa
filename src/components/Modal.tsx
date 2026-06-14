import type { ReactNode } from 'react'

// Оболочка модалки: затемнение + светлая карточка, закрытие по клику вне/по Esc.
// Убирает повторяющийся бойлерплейт `fixed inset-0 + bg-black/.. + stopPropagation`.
// Тёмные кассовые модалки (numpad/клавиатура) — отдельные компоненты, их не трогаем.
export default function Modal({ children, onClose, width = 'w-[380px]', className = '', z = 'z-50' }: {
  children: ReactNode
  onClose: () => void
  width?: string
  className?: string
  z?: string
}) {
  return (
    <div className={`fixed inset-0 ${z} bg-black/60 flex items-center justify-center p-4`} onClick={onClose}>
      <div className={`bg-white text-gray-800 rounded-lg ${width} ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
