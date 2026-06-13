import { useNavigate } from 'react-router-dom'
import { Menu, Lock, Mail } from 'lucide-react'
import { usePos } from '../store/pos'

interface Props {
  title?: string
  left?: React.ReactNode
}

// Верхняя строка кассы: версия/время слева, заголовок, меню и блокировка справа.
export default function TopBar({ title, left }: Props) {
  const navigate = useNavigate()
  const { user, cashShift, logout, messages } = usePos()
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const unread = messages.filter((m) => m.unread).length

  return (
    <div className="h-12 bg-white flex items-center justify-between px-3 border-b border-gray-300 shrink-0">
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>iiko POS v0.1 (мок)</span>
        <span>{time}</span>
        {cashShift && <span className="text-pos-green">Смена №{cashShift.no} открыта</span>}
        {left}
      </div>
      {title && <div className="font-semibold text-gray-800">{title}</div>}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.name}</span>
        <button onClick={() => navigate('/messages')} className="text-gray-700 relative" title="Сообщения">
          <Mail size={20} />
          {unread > 0 && <span className="absolute -top-1.5 -right-1.5 bg-pos-rose text-gray-900 text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold">{unread}</span>}
        </button>
        <button onClick={() => navigate('/menu')} className="text-gray-700" title="Доп. меню"><Menu size={22} /></button>
        <button onClick={() => { logout(); navigate('/') }} className="text-gray-700" title="Заблокировать"><Lock size={18} /></button>
      </div>
    </div>
  )
}
