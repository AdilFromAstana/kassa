import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Lock, Mail, PackageX } from 'lucide-react'
import { usePos } from '../store/pos'
import { lowStock } from '../lib/stockAlerts'

const fmtQty = (n: number) => String(n).replace('.', ',')

interface Props {
  title?: string
  left?: React.ReactNode
}

// Верхняя строка кассы: версия/время слева, заголовок, меню и блокировка справа.
export default function TopBar({ title, left }: Props) {
  const navigate = useNavigate()
  const { user, cashShift, logout, messages, ingredients } = usePos()
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const unread = messages.filter((m) => m.unread).length
  const stock = lowStock(ingredients)
  const [stockOpen, setStockOpen] = useState(false)

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
        {/* Индикатор низкого остатка склада: бейдж = закончилось + заканчивается; клик → список */}
        <div className="relative">
          <button onClick={() => setStockOpen((v) => !v)} className="text-gray-700 relative flex items-center" title="Остатки склада">
            <PackageX size={20} className={stock.severity === 'out' ? 'text-pos-rose' : stock.severity === 'low' ? 'text-amber-500' : 'text-gray-400'} />
            {stock.count > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold ${stock.severity === 'out' ? 'bg-pos-rose' : 'bg-amber-500'}`}>{stock.count}</span>
            )}
          </button>
          {stockOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setStockOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-40 text-gray-800">
                <div className="px-4 h-11 flex items-center border-b border-gray-100 font-semibold text-sm">Остатки склада</div>
                <div className="max-h-80 overflow-auto py-1">
                  {stock.count === 0 && <div className="px-4 py-6 text-center text-sm text-gray-400">Все остатки в норме</div>}
                  {stock.out.map((i) => (
                    <div key={i.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-pos-rose shrink-0" />
                      <span className="flex-1 truncate">{i.name}</span>
                      <span className="text-pos-rose font-medium">закончился</span>
                    </div>
                  ))}
                  {stock.low.map((i) => (
                    <div key={i.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="flex-1 truncate">{i.name}</span>
                      <span className="text-amber-600">{fmtQty(i.stock)} / мин {fmtQty(i.min)} {i.unit}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setStockOpen(false); navigate('/warehouse') }} className="w-full h-11 border-t border-gray-100 text-sm text-pos-blue font-medium hover:bg-gray-50">Открыть склад</button>
              </div>
            </>
          )}
        </div>
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
