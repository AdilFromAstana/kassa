import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos } from '../store/pos'
import { fiscalRegistrators } from '../mock/data'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Команды фискальному регистратору (КАССА → Команды ФР). KZ ФР = Webkassa.
export default function FiscalCommandsScreen() {
  const navigate = useNavigate()
  const { cashShift, closedOrders } = usePos()
  const [fr, setFr] = useState(fiscalRegistrators[0].id)
  const reg = fiscalRegistrators.find((f) => f.id === fr)!

  const cmd = (label: string, result: string) => ({ label, result })
  const commands = [
    cmd('X-отчёт (без гашения)', `X-отчёт ФР ${reg.name}: чеков ${closedOrders.length}`),
    cmd('Состояние ФР', `${reg.model} · ФН ${reg.fn} · смена ${reg.shiftOpen ? 'открыта' : 'закрыта'}`),
    cmd('Копия последнего чека', 'Копия последнего фискального чека'),
    cmd('Открыть денежный ящик', 'Денежный ящик открыт'),
    cmd('Запрос связи с ОФД', 'Связь с ОФД РК: ОК, непереданных чеков: 0'),
    cmd('Тех. обнуление', 'Технологическое обнуление выполнено'),
  ]

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Команды фискальному регистратору" />
      <div className="px-6 pt-4 flex gap-2">
        {fiscalRegistrators.map((f) => (
          <button key={f.id} onClick={() => setFr(f.id)}
            className={`px-4 h-10 rounded-md ${fr === f.id ? 'bg-pos-blue' : 'bg-white/10'}`}>{f.name}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-3 max-w-3xl">
          {commands.map((c) => (
            <button key={c.label} onClick={() => printToast(c.result)}
              disabled={!cashShift && c.label.includes('отчёт')}
              className="h-20 rounded-md bg-white text-gray-800 active:bg-gray-100 disabled:opacity-40">{c.label}</button>
          ))}
        </div>
        <div className="text-white/40 text-xs mt-4">KZ Команды идут через драйвер Webkassa. Реальные операции подключаются на бэкенде/.NET.</div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
