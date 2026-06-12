import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { usePos } from '../store/pos'
import { fiscalRegistrators } from '../mock/data'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'

// Подробнее по ФР и кассовым сменам (КАССА → Подробнее…). KZ Webkassa.
export default function FiscalDetailsScreen() {
  const navigate = useNavigate()
  const { cashShift, closedOrders, cashMovements } = usePos()
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)
  const receipts = closedOrders.length

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Фискальные регистраторы и смены" />
      <div className="flex-1 overflow-auto p-6 max-w-4xl">
        <div className="mb-4 bg-white/5 rounded-lg p-4">
          <div className="text-pos-accent text-sm uppercase mb-2">Кассовая смена</div>
          {cashShift ? (
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-white/50">Номер смены</span><b>№{cashShift.no}</b>
              <span className="text-white/50">Открыта</span><span>{cashShift.openedAt}</span>
              <span className="text-white/50">Кассир</span><span>{cashShift.openedBy}</span>
              <span className="text-white/50">Чеков пробито</span><span>{receipts}</span>
              <span className="text-white/50">Выручка</span><b>{formatTenge(revenue)}</b>
              <span className="text-white/50">Внесений/изъятий</span><span>{cashMovements.length}</span>
            </div>
          ) : <div className="text-white/50">Кассовая смена закрыта</div>}
        </div>

        <div className="text-pos-accent text-sm uppercase mb-2">Фискальные регистраторы: {fiscalRegistrators.length}</div>
        <div className="grid grid-cols-2 gap-4">
          {fiscalRegistrators.map((f) => (
            <div key={f.id} className="bg-white/5 rounded-lg p-4 text-sm">
              <div className="font-semibold mb-2">{f.name}</div>
              <div className="grid grid-cols-2 gap-y-1">
                <span className="text-white/50">Модель</span><span>{f.model}</span>
                <span className="text-white/50">Заводской №</span><span>{f.serial}</span>
                <span className="text-white/50">ФН</span><span>{f.fn}</span>
                <span className="text-white/50">Организация</span><span>{f.org}</span>
                <span className="text-white/50">БИН</span><span>{f.bin}</span>
                <span className="text-white/50">Смена на ФР</span><span className={f.shiftOpen ? 'text-pos-green' : 'text-white/50'}>{f.shiftOpen ? 'открыта' : 'закрыта'}</span>
                <span className="text-white/50">Чеков на ФР</span><span>{f.receipts}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-white/40 text-xs mt-4">KZ Два ФР на одной кассе (разные юрлица/назначение). Печать распределяется по типу заказа или месту приготовления.</div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
