import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import BackButton from '../components/BackButton'
import { usePos } from '../store/pos'
import type { Establishment } from '../types'

// Настройки заведения (Инструменты → Настройки заведения).
// В реальной айке профиль приходит из офиса (режим терминала + настройки ТП + лицензии);
// здесь задаётся вручную и управляет видимостью кнопок по всему фронту.
const FLAGS: { key: keyof Establishment; label: string; note: string }[] = [
  { key: 'precheck', label: 'Печать пречека', note: 'кнопка «Пречек» (только ресторан)' },
  { key: 'comments', label: 'Комментарии', note: 'комментарий к заказу/блюду' },
  { key: 'courses', label: 'Курсы подачи', note: 'панель «Курсы» (в разработке)' },
  { key: 'tab', label: 'Барный таб', note: 'открытый счёт у стойки (в разработке)' },
  { key: 'mix', label: 'MIX / составное', note: 'комбо/составные блюда (в разработке)' },
  { key: 'kitchenScreen', label: 'Кухонный экран', note: '«Вне очереди», печать на кухню' },
  { key: 'banquets', label: 'Банкеты и резервы', note: 'раздел «Банкеты» в меню' },
  { key: 'delivery', label: 'Доставка (iikoDelivery)', note: 'адрес, курьеры (в разработке)' },
  { key: 'iikoCard', label: 'iikoCard (лояльность)', note: 'бонусы в оплате (в разработке)' },
  { key: 'fiscalBeforePay', label: 'Фискальный чек до оплаты', note: 'печать фискального чека перед приёмом денег (9.x)' },
]

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { establishment: est, setEstablishment, seedDemo, clearDemo, demoAuto, setDemoAuto, closedOrders, orders } = usePos()

  const Toggle = ({ on, onClick, label, note }: { on: boolean; onClick: () => void; label: string; note: string }) => (
    <button onClick={onClick} className="flex items-center justify-between h-16 px-4 rounded-md bg-white/5 hover:bg-white/10 text-left">
      <div>
        <div className="text-white">{label}</div>
        <div className="text-xs text-white/40">{note}</div>
      </div>
      <div className={`w-12 h-7 rounded-full flex items-center px-0.5 transition ${on ? 'bg-pos-green justify-end' : 'bg-white/20 justify-start'}`}>
        <div className="w-6 h-6 rounded-full bg-white" />
      </div>
    </button>
  )

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <div className="h-14 bg-white text-gray-800 flex items-center px-4 shrink-0">
        <div className="font-semibold">Настройки заведения</div>
        <div className="ml-auto text-sm text-gray-500">профиль: {est.name}</div>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-3xl w-full mx-auto">
        <div className="text-white/40 text-xs mb-4">В реальной iiko приходит из офиса (режим группы терминалов + настройки ТП + лицензии). Здесь — для демо: меняет видимость кнопок по всему фронту. Сохраняется локально.</div>

        {/* тип заведения / режим */}
        <div className="mb-6">
          <div className="text-pos-accent text-sm uppercase mb-2">Тип заведения (режим обслуживания)</div>
          <div className="grid grid-cols-2 gap-3">
            {([['restaurant', 'Ресторан', 'столы, гости, деление, пречек'], ['fastfood', 'Фастфуд', 'быстрый чек, без столов и пречека']] as const).map(([m, label, note]) => (
              <button key={m} onClick={() => setEstablishment({ mode: m, name: m === 'restaurant' ? 'Ресторан (KZ)' : 'Фастфуд (KZ)' })}
                className={`h-20 rounded-md flex flex-col items-center justify-center ${est.mode === m ? 'bg-pos-green text-white' : 'bg-white/10 text-white/80'}`}>
                <span className="text-lg font-semibold flex items-center gap-2">{est.mode === m && <Check size={18} />}{label}</span>
                <span className="text-xs opacity-70">{note}</span>
              </button>
            ))}
          </div>
        </div>

        {/* фичи */}
        <div className="mb-6">
          <div className="text-pos-accent text-sm uppercase mb-2">Функции</div>
          <div className="grid grid-cols-2 gap-2">
            {FLAGS.map((f) => (
              <Toggle key={f.key} label={f.label} note={f.note}
                on={Boolean(est[f.key])}
                onClick={() => setEstablishment({ [f.key]: !est[f.key] } as Partial<Establishment>)} />
            ))}
          </div>
        </div>

        {/* число ФР */}
        <div className="mb-6">
          <div className="text-pos-accent text-sm uppercase mb-2">Фискальные регистраторы</div>
          <div className="flex gap-3">
            {([1, 2] as const).map((n) => (
              <button key={n} onClick={() => setEstablishment({ frCount: n })}
                className={`h-12 px-8 rounded-md ${est.frCount === n ? 'bg-pos-blue text-white' : 'bg-white/10 text-white/80'}`}>{n} ФР</button>
            ))}
          </div>
        </div>

        {/* демо-данные для показа без бэка */}
        <div>
          <div className="text-pos-accent text-sm uppercase mb-2">Демо-данные (для показа)</div>
          <div className="text-white/40 text-xs mb-3">
            Генерирует заказы за сегодняшний вечер (разные блюда, цены, типы оплаты, номера ФД, время — от момента запуска).
            По ним можно выбивать чеки, делать возвраты, менять тип оплаты, строить отчёты и закрывать смену.
            Сейчас: <b className="text-white/70">{closedOrders.length}</b> закрытых, <b className="text-white/70">{orders.length}</b> открытых.
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[12, 24, 40].map((n) => (
              <button key={n} onClick={() => seedDemo(n)} className="h-12 px-5 rounded-md bg-pos-green text-white">Сгенерировать {n}</button>
            ))}
            <button onClick={clearDemo} className="h-12 px-5 rounded-md bg-pos-rose text-gray-900">Очистить</button>
          </div>
          <button onClick={() => setDemoAuto(!demoAuto)} className="flex items-center justify-between w-full h-16 px-4 rounded-md bg-white/5 hover:bg-white/10 text-left">
            <div>
              <div className="text-white">Авто-наполнение при запуске</div>
              <div className="text-xs text-white/40">Включи перед показом: при открытии касса сама заполнится заказами на текущее время (24 шт + смена открыта).</div>
            </div>
            <div className={`w-12 h-7 rounded-full flex items-center px-0.5 transition shrink-0 ${demoAuto ? 'bg-pos-green justify-end' : 'bg-white/20 justify-start'}`}>
              <div className="w-6 h-6 rounded-full bg-white" />
            </div>
          </button>
        </div>
      </div>

      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
