import { useNavigate } from 'react-router-dom'
import { Check, Monitor } from 'lucide-react'
import { usePos } from '../store/pos'
import type { Establishment } from '../types'

// iikoOffice (мок бэк-офиса) — здесь редактируется конфиг заведения, который «уезжает» на кассу (Front).
// Один общий стор + localStorage: изменения применяются на кассе сразу (и переживают перезагрузку).
// Это отдельный раздел в том же проекте (маршрут /office); касса — остальные маршруты.
const FLAGS: { key: keyof Establishment; label: string; note: string }[] = [
  { key: 'precheck', label: 'Печать пречека', note: 'кнопка «Пречек» (ресторан)' },
  { key: 'comments', label: 'Комментарии', note: 'комментарий к заказу/блюду' },
  { key: 'courses', label: 'Курсы подачи', note: 'панель «Курсы»' },
  { key: 'tab', label: 'Барный таб', note: 'открытый счёт у стойки' },
  { key: 'mix', label: 'MIX / составное', note: 'комбо/составные блюда' },
  { key: 'kitchenScreen', label: 'Кухонный экран (KDS)', note: '«Вне очереди», печать на кухню' },
  { key: 'banquets', label: 'Банкеты и резервы', note: 'раздел «Банкеты» на кассе' },
  { key: 'delivery', label: 'Доставка (iikoDelivery)', note: 'адрес, курьеры' },
  { key: 'iikoCard', label: 'iikoCard (лояльность)', note: 'бонусы в оплате' },
  { key: 'fiscalBeforePay', label: 'Фискальный чек до оплаты', note: 'печать ФД перед приёмом денег (9.x)' },
]

const NAV = [
  { label: 'Настройки заведения', active: true },
  { label: 'Меню и цены', active: false },
  { label: 'Номенклатура и техкарты', active: false },
  { label: 'Сотрудники и права', active: false },
  { label: 'Отчёты', active: false },
]

export default function OfficeScreen() {
  const navigate = useNavigate()
  const { establishment: est, setEstablishment } = usePos()

  const Toggle = ({ k, label, note }: { k: keyof Establishment; label: string; note: string }) => (
    <button onClick={() => setEstablishment({ [k]: !est[k] } as Partial<Establishment>)}
      className="flex items-center justify-between h-16 px-4 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-left">
      <div>
        <div className="text-gray-800">{label}</div>
        <div className="text-xs text-gray-400">{note}</div>
      </div>
      <div className={`w-12 h-7 rounded-full flex items-center px-0.5 transition ${est[k] ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'}`}>
        <div className="w-6 h-6 rounded-full bg-white shadow" />
      </div>
    </button>
  )

  return (
    <div className="h-full flex bg-gray-100 text-gray-800">
      {/* сайдбар */}
      <div className="w-60 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 font-semibold border-b border-white/10">iikoOffice <span className="text-white/40 text-xs ml-2">мок</span></div>
        <nav className="flex-1 py-2">
          {NAV.map((n) => (
            <div key={n.label}
              className={`px-5 h-11 flex items-center text-sm ${n.active ? 'bg-white/10 border-l-2 border-emerald-400 font-medium' : 'text-white/50'}`}>
              {n.label}{!n.active && <span className="ml-auto text-[10px] text-white/30">скоро</span>}
            </div>
          ))}
        </nav>
        <button onClick={() => navigate('/')}
          className="m-4 h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2">
          <Monitor size={18} /> Открыть кассу (Front)
        </button>
      </div>

      {/* контент */}
      <div className="flex-1 overflow-auto">
        <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <div className="font-semibold">Настройки торгового предприятия</div>
          <div className="ml-auto text-xs text-gray-400">конфиг уезжает на кассу · сохраняется в localStorage</div>
        </div>

        <div className="p-6 max-w-3xl">
          <div className="text-xs text-gray-500 mb-5">
            Здесь (как в реальном iikoOffice) задаётся профиль заведения. Касса (Front) только читает его и применяет —
            на самой кассе эти настройки не редактируются. Изменения вступают в силу сразу при переходе на кассу.
          </div>

          {/* тип заведения / режим */}
          <div className="mb-6">
            <div className="text-gray-500 text-xs uppercase mb-2">Тип заведения (режим обслуживания)</div>
            <div className="grid grid-cols-2 gap-3">
              {([['restaurant', 'Ресторан', 'столы, гости, деление, пречек'], ['fastfood', 'Фастфуд', 'быстрый чек, без столов и пречека']] as const).map(([m, label, note]) => (
                <button key={m} onClick={() => setEstablishment({ mode: m, name: m === 'restaurant' ? 'Ресторан (KZ)' : 'Фастфуд (KZ)' })}
                  className={`h-20 rounded-md flex flex-col items-center justify-center border ${est.mode === m ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-700 border-gray-200'}`}>
                  <span className="text-lg font-semibold flex items-center gap-2">{est.mode === m && <Check size={18} />}{label}</span>
                  <span className="text-xs opacity-70">{note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* функции */}
          <div className="mb-6">
            <div className="text-gray-500 text-xs uppercase mb-2">Функции</div>
            <div className="grid grid-cols-2 gap-2">
              {FLAGS.map((f) => <Toggle key={f.key} k={f.key} label={f.label} note={f.note} />)}
            </div>
          </div>

          {/* число ФР */}
          <div className="mb-2">
            <div className="text-gray-500 text-xs uppercase mb-2">Фискальные регистраторы</div>
            <div className="flex gap-3">
              {([1, 2] as const).map((n) => (
                <button key={n} onClick={() => setEstablishment({ frCount: n })}
                  className={`h-12 px-8 rounded-md border ${est.frCount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>{n} ФР</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
