import { ChevronLeft } from 'lucide-react'

// Кнопка «Назад» как в iikoFront: крупная иконка + текст под ней.
export default function BackButton({ onClick, label = 'НАЗАД' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-gray-700 active:scale-95 select-none">
      <ChevronLeft size={26} />
      {label}
    </button>
  )
}
