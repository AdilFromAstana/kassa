import { useNavigate, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { printToast } from '../lib/print'
import { usePos } from '../store/pos'
import TopBar from '../components/TopBar'

// Дополнения / Инструменты (нижняя панель доп. меню) — служебные разделы.
const ADDONS = [
  { label: 'iikoDelivery (доставка)', note: 'модуль доставки' },
  { label: 'iikoCard (лояльность)', note: 'бонусы · депозит · сертификаты' },
  { label: 'Кухонный экран (KDS)', note: 'экран повара' },
  { label: 'Электронное меню (QR)', note: 'заказ со стола' },
  { label: 'Видеонаблюдение', note: 'привязка чеков к видео' },
]
const TOOLS = [
  { label: 'Тест печати', note: 'печать тестового чека', print: 'Тестовый чек' },
  { label: 'Обновить меню с сервера', note: 'синхронизация с офисом', print: 'Меню обновлено с сервера' },
  { label: 'Лог обмена с сервером', note: 'диагностика синхронизации' },
  { label: 'Перезагрузить терминал', note: 'служебная операция' },
]

export default function ExtrasScreen() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const { establishment, demoAuto, seedDemo, clearDemo, setDemoAuto, closedOrders } = usePos()
  const kind = sp.get('kind') === 'tools' ? 'tools' : 'addons'
  const items = kind === 'tools' ? TOOLS : ADDONS
  const title = kind === 'tools' ? 'Инструменты' : 'Дополнения'

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title={title} />
      <div className="flex-1 overflow-auto p-6">
        {kind === 'tools' && (
          <div className="mb-5 max-w-3xl w-full grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/equipment')} className="bg-white/5 hover:bg-white/10 rounded-lg p-4 text-left">
              <div className="text-pos-accent text-sm uppercase mb-1">Настройка оборудования ›</div>
              <div className="text-xs text-white/50">ФР/ОФД (Webkassa), принтер чеков, денежный ящик, весы. Локальные настройки терминала (iikoAgent).</div>
            </button>
            <button onClick={() => navigate('/warehouse')} className="bg-white/5 hover:bg-white/10 rounded-lg p-4 text-left">
              <div className="text-pos-accent text-sm uppercase mb-1">Товары и склады ›</div>
              <div className="text-xs text-white/50">Остатки товаров, техкарты и себестоимость. Ингредиенты списываются по техкарте при оплате заказа.</div>
            </button>
            <button onClick={() => navigate('/settings')} className="bg-white/5 hover:bg-white/10 rounded-lg p-4 text-left">
              <div className="text-pos-accent text-sm uppercase mb-1">Настройки заведения (из офиса) ›</div>
              <div className="text-xs text-white/50">Тип ({establishment.mode === 'restaurant' ? 'Ресторан' : 'Фастфуд'}), функции, число ФР — только просмотр; редактируется в Бэк-офисе.</div>
            </button>
          </div>
        )}

        {/* Демо-данные (мок) — наполнение/сброс для показа без бэка */}
        {kind === 'tools' && (
          <div className="mb-5 max-w-3xl w-full bg-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-pos-accent text-sm uppercase">Демо-данные (мок)</div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-400 text-amber-950 font-semibold">{demoAuto ? 'ВКЛ' : 'ВЫКЛ'}</span>
              <span className="ml-auto text-xs text-white/40">в текущей смене: {closedOrders.length} чеков</span>
            </div>
            <div className="text-xs text-white/50 mb-3">Наполнение кассы/офиса данными рабочего дня для показа. Реальные действия сохраняются и перетирают демо.</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { seedDemo(); printToast('Сгенерирован рабочий день (заказы, оплаты, отчёты)') }}
                className="h-10 px-4 rounded-md bg-pos-green text-white text-sm">Сгенерировать день</button>
              <button onClick={() => { clearDemo(); printToast('Демо-данные очищены (касса пустая)') }}
                className="h-10 px-4 rounded-md bg-white/10 hover:bg-white/20 text-sm">Очистить</button>
              <button onClick={() => { setDemoAuto(!demoAuto); printToast(demoAuto ? 'Авто-наполнение выключено' : 'Авто-наполнение включено (при запуске)') }}
                className="h-10 px-4 rounded-md bg-white/10 hover:bg-white/20 text-sm">{demoAuto ? 'Выключить авто-наполнение' : 'Включить авто-наполнение'}</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 max-w-3xl">
          {items.map((it) => {
            const pr = (it as { print?: string }).print
            return (
            <button key={it.label}
              onClick={() => printToast(pr ?? `${it.label} — раздел появится при подключении модуля/бэкенда`)}
              className="h-24 rounded-md bg-white text-gray-800 active:bg-gray-100 flex flex-col items-center justify-center">
              <span className="font-medium">{it.label}</span>
              <span className="text-xs text-gray-500">{it.note}</span>
            </button>
            )
          })}
        </div>
        <div className="text-white/40 text-xs mt-4">Раздел «{title}» — служебный. Функции активируются модулями/лицензией и бэкендом (.NET).</div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
