import { useNavigate } from 'react-router-dom'
import { Printer, Banknote, Scale, ReceiptText, CheckCircle2 } from 'lucide-react'
import BackButton from '../components/BackButton'
import TopBar from '../components/TopBar'
import { usePos } from '../store/pos'
import { printToast } from '../lib/print'

// Настройка оборудования (Инструменты → Настройка оборудования) — реальные ЛОКАЛЬНЫЕ настройки
// терминала iikoFront (через iikoAgent): ФР/ОФД (Webkassa), принтер чеков, денежный ящик, весы.
// Конфиг заведения (меню/режим/фичи) сюда НЕ входит — он приходит из офиса (/office).
export default function EquipmentScreen() {
  const navigate = useNavigate()
  const { establishment } = usePos()

  const fr = Array.from({ length: establishment.frCount }, (_, i) => ({
    icon: ReceiptText,
    name: `Фискальный регистратор №${998 + i} (Webkassa)`,
    note: 'ОФД РК · KZ БИН 123456789012 · ҚҚС 16%',
    ok: true,
  }))
  const devices = [
    ...fr,
    { icon: Printer, name: 'Принтер чеков', note: 'термопринтер 80 мм (iikoAgent)', ok: true },
    { icon: Banknote, name: 'Денежный ящик', note: 'открытие по чеку / вручную', ok: true },
    { icon: Scale, name: 'Весы', note: 'не подключены', ok: false },
  ]

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Настройка оборудования" />
      <div className="flex-1 overflow-auto p-6">
        <div className="text-white/50 text-sm mb-4 max-w-2xl">
          Локальные настройки терминала (через iikoAgent). Конфиг заведения — меню, режим, функции — сюда не входит, он приходит из офиса (Бэк-офис).
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-3xl">
          {devices.map((d, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-4 flex items-center gap-4">
              <d.icon size={28} className="text-white/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{d.name}</span>
                  {d.ok
                    ? <span className="text-pos-green text-xs inline-flex items-center gap-1"><CheckCircle2 size={13} />подключено</span>
                    : <span className="text-white/40 text-xs">не подключено</span>}
                </div>
                <div className="text-xs text-white/40">{d.note}</div>
              </div>
              <button onClick={() => printToast(d.ok ? `${d.name}: связь OK` : `${d.name}: не найдено`)}
                className="h-9 px-3 rounded bg-white/10 hover:bg-white/20 text-sm shrink-0">Проверить</button>
            </div>
          ))}
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
