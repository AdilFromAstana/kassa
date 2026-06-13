import { useNavigate } from 'react-router-dom'
import { Check, X, Monitor } from 'lucide-react'
import BackButton from '../components/BackButton'
import { usePos } from '../store/pos'
import type { Establishment } from '../types'

// Настройки заведения на кассе — ТОЛЬКО ПРОСМОТР. В реальной iiko конфиг приходит из офиса
// (iikoOffice): режим, функции, лицензии. Редактируется в Бэк-офисе (/office); касса применяет.
// Здесь же — служебная панель демо-данных (для показа без бэкенда).
const FLAGS: { key: keyof Establishment; label: string }[] = [
  { key: 'precheck', label: 'Печать пречека' },
  { key: 'comments', label: 'Комментарии' },
  { key: 'courses', label: 'Курсы подачи' },
  { key: 'tab', label: 'Барный таб' },
  { key: 'mix', label: 'MIX / составное' },
  { key: 'kitchenScreen', label: 'Кухонный экран (KDS)' },
  { key: 'banquets', label: 'Банкеты и резервы' },
  { key: 'delivery', label: 'Доставка (iikoDelivery)' },
  { key: 'iikoCard', label: 'iikoCard (лояльность)' },
  { key: 'fiscalBeforePay', label: 'Фискальный чек до оплаты' },
]

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { establishment: est, seedDemo, clearDemo, demoAuto, setDemoAuto, closedOrders, orders } = usePos()

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <div className="h-14 bg-white text-gray-800 flex items-center px-4 shrink-0">
        <div className="font-semibold">Настройки заведения</div>
        <div className="ml-auto text-sm text-gray-500">профиль: {est.name}</div>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-3xl w-full mx-auto">
        {/* конфиг из офиса — только просмотр */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-white/50 text-xs flex-1">
            Конфиг приходит из офиса (iikoOffice). На кассе — только просмотр. Изменить → Бэк-офис.
          </div>
          <button onClick={() => navigate('/office')} className="h-10 px-4 rounded-md bg-pos-blue text-white text-sm inline-flex items-center gap-2 shrink-0">
            <Monitor size={16} /> Открыть Бэк-офис
          </button>
        </div>

        <div className="mb-6">
          <div className="text-pos-accent text-sm uppercase mb-2">Тип заведения</div>
          <div className="h-12 px-4 rounded-md bg-white/5 flex items-center">
            {est.mode === 'restaurant' ? 'Ресторан (столы, гости, деление, пречек)' : 'Фастфуд (быстрый чек, без столов)'}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-pos-accent text-sm uppercase mb-2">Функции (из офиса)</div>
          <div className="grid grid-cols-2 gap-2">
            {FLAGS.map((f) => {
              const on = Boolean(est[f.key])
              return (
                <div key={f.key} className="flex items-center justify-between h-12 px-4 rounded-md bg-white/5">
                  <span className="text-white/80">{f.label}</span>
                  {on
                    ? <span className="text-pos-green text-xs inline-flex items-center gap-1"><Check size={14} />вкл</span>
                    : <span className="text-white/30 text-xs inline-flex items-center gap-1"><X size={14} />выкл</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-8">
          <div className="text-pos-accent text-sm uppercase mb-2">Фискальные регистраторы</div>
          <div className="h-12 px-4 rounded-md bg-white/5 flex items-center">{est.frCount} ФР</div>
        </div>

        {/* Лицензии (Администрирование → Лицензии): модули + срок действия. На кассе — только просмотр. */}
        <div className="mb-8">
          <div className="text-pos-accent text-sm uppercase mb-2">Лицензии (модули)</div>
          <div className="text-white/40 text-xs mb-2">Редакция: iikoRMS · терминалов: 1 · поставка из офиса. KZ: фискализация — Webkassa (ОФД РК).</div>
          <div className="rounded-md bg-white/5 overflow-hidden">
            <div className="flex items-center px-4 py-2 text-xs text-white/40 border-b border-white/10">
              <span className="flex-1">Модуль</span><span className="w-28 text-center">Статус</span><span className="w-28 text-right">Действует до</span>
            </div>
            {([
              ['iikoFront (касса)', true],
              ['Webkassa / ОФД РК', true],
              ['Резервы и банкеты', est.banquets],
              ['Кухонный экран (KDS)', est.kitchenScreen],
              ['Доставка (iikoDelivery)', est.delivery],
              ['iikoCard (лояльность)', est.iikoCard],
            ] as const).map(([name, on]) => (
              <div key={name} className="flex items-center px-4 py-2.5 border-b border-white/5 text-sm">
                <span className="flex-1">{name}</span>
                <span className="w-28 text-center">
                  {on ? <span className="text-pos-green text-xs inline-flex items-center gap-1"><Check size={13} />активна</span>
                      : <span className="text-white/30 text-xs inline-flex items-center gap-1"><X size={13} />не подключён</span>}
                </span>
                <span className="w-28 text-right text-white/50">{on ? '31.12.2026' : '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* демо-данные — служебная дев-панель (не реальная айка) */}
        <div className="border-t border-white/10 pt-5">
          <div className="text-pos-accent text-sm uppercase mb-2">Демо / разработка (не из айки)</div>
          <div className="text-white/40 text-xs mb-3">
            Служебный генератор данных для показа без бэкенда: заказы за «сегодняшний вечер» (блюда/оплаты/ФД).
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
              <div className="text-xs text-white/40">При открытии касса сама заполнится заказами (24 шт + смена открыта).</div>
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
