import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, Banknote, Scale, ReceiptText, Monitor, CreditCard, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BackButton from '../components/BackButton'
import TopBar from '../components/TopBar'
import { printToast } from '../lib/print'

// Настройка оборудования (Инструменты → Настройка оборудования) — ЛОКАЛЬНЫЕ настройки терминала
// iikoFront (через iikoAgent): вкладки по устройствам с параметрами подключения (COM/IP/порт/скорость).
// Конфиг заведения (меню/режим/фичи) сюда НЕ входит — он приходит из офиса (/office).
type Field = { label: string; value: string; options?: string[] }
type Device = { key: string; name: string; icon: LucideIcon; connected: boolean; fields: Field[] }

const DEFAULTS: Device[] = [
  { key: 'printer', name: 'Чековый принтер', icon: Printer, connected: true, fields: [
    { label: 'Интерфейс', value: 'USB', options: ['USB', 'COM', 'Сеть (TCP/IP)'] },
    { label: 'Порт', value: 'COM3' },
    { label: 'Скорость (бод)', value: '115200', options: ['9600', '19200', '38400', '57600', '115200'] },
    { label: 'Ширина ленты', value: '80 мм', options: ['58 мм', '80 мм'] },
  ] },
  { key: 'drawer', name: 'Денежный ящик', icon: Banknote, connected: true, fields: [
    { label: 'Подключение', value: 'Через принтер', options: ['Через принтер', 'COM напрямую'] },
    { label: 'Порт', value: 'COM3' },
    { label: 'Импульс открытия (мс)', value: '120' },
  ] },
  { key: 'display', name: 'Дисплей покупателя', icon: Monitor, connected: false, fields: [
    { label: 'Интерфейс', value: 'COM', options: ['COM', 'USB'] },
    { label: 'Порт', value: 'COM4' },
    { label: 'Скорость (бод)', value: '9600', options: ['2400', '9600', '19200'] },
    { label: 'Формат', value: '2×20', options: ['2×16', '2×20'] },
  ] },
  { key: 'cardreader', name: 'Считыватель карт', icon: CreditCard, connected: false, fields: [
    { label: 'Интерфейс', value: 'USB-HID', options: ['USB-HID', 'COM'] },
    { label: 'Порт', value: '—' },
    { label: 'Дорожка', value: 'Track 2', options: ['Track 1', 'Track 2', 'Track 1+2'] },
  ] },
  { key: 'scale', name: 'Весы', icon: Scale, connected: false, fields: [
    { label: 'Интерфейс', value: 'COM', options: ['COM', 'USB'] },
    { label: 'Порт', value: 'COM5' },
    { label: 'Протокол', value: 'CAS', options: ['CAS', 'Масса-К', 'Штрих'] },
    { label: 'Скорость (бод)', value: '9600', options: ['4800', '9600', '19200'] },
  ] },
  { key: 'fr', name: 'Фискальный регистратор (Webkassa)', icon: ReceiptText, connected: true, fields: [
    { label: 'Режим', value: 'Онлайн (ОФД РК)', options: ['Онлайн (ОФД РК)', 'Автономный'] },
    { label: 'Хост / IP', value: '127.0.0.1' },
    { label: 'Порт', value: '8080' },
    { label: 'БИН организации', value: '123456789012' },
    { label: 'Кассир (логин)', value: 'kassa01' },
  ] },
]

const STORE_KEY = 'iiko-equipment'
function loadDevices(): Device[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, { connected: boolean; values: string[] }>
      return DEFAULTS.map((d) => saved[d.key]
        ? { ...d, connected: saved[d.key].connected, fields: d.fields.map((f, i) => ({ ...f, value: saved[d.key].values[i] ?? f.value })) }
        : d)
    }
  } catch { /* ignore */ }
  return DEFAULTS
}

export default function EquipmentScreen() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>(loadDevices)
  const [active, setActive] = useState(0)
  const dev = devices[active]

  const persist = (next: Device[]) => {
    setDevices(next)
    try {
      const map: Record<string, { connected: boolean; values: string[] }> = {}
      for (const d of next) map[d.key] = { connected: d.connected, values: d.fields.map((f) => f.value) }
      localStorage.setItem(STORE_KEY, JSON.stringify(map))
    } catch { /* ignore */ }
  }
  const setField = (fi: number, value: string) =>
    persist(devices.map((d, i) => (i === active ? { ...d, fields: d.fields.map((f, j) => (j === fi ? { ...f, value } : f)) } : d)))
  const toggleConnected = () =>
    persist(devices.map((d, i) => (i === active ? { ...d, connected: !d.connected } : d)))

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Настройка оборудования" />
      <div className="flex-1 flex overflow-hidden">
        {/* вкладки устройств */}
        <div className="w-72 bg-black/30 overflow-auto shrink-0">
          {devices.map((d, i) => (
            <button key={d.key} onClick={() => setActive(i)}
              className={`w-full h-16 px-4 flex items-center gap-3 border-b border-white/10 text-left ${i === active ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
              <d.icon size={22} className="shrink-0 text-white/70" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">{d.name}</div>
                <div className={`text-xs ${d.connected ? 'text-pos-green' : 'text-white/40'}`}>{d.connected ? 'подключено' : 'не подключено'}</div>
              </div>
            </button>
          ))}
        </div>

        {/* параметры выбранного устройства */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center gap-3 mb-1">
            <dev.icon size={26} className="text-white/70" />
            <div className="text-lg">{dev.name}</div>
            {dev.connected
              ? <span className="text-pos-green text-xs inline-flex items-center gap-1 ml-2"><CheckCircle2 size={14} />подключено</span>
              : <span className="text-white/40 text-xs ml-2">не подключено</span>}
          </div>
          <div className="text-white/40 text-sm mb-5">Локальные параметры подключения (через iikoAgent).</div>

          <div className="max-w-xl space-y-3">
            {dev.fields.map((f, fi) => (
              <div key={f.label} className="flex items-center gap-3">
                <label className="w-48 text-right text-white/60 text-sm shrink-0">{f.label}</label>
                {f.options
                  ? <select value={f.value} onChange={(e) => setField(fi, e.target.value)} className="flex-1 h-11 rounded-md px-2 bg-white text-gray-800">
                      {f.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  : <input value={f.value} onChange={(e) => setField(fi, e.target.value)} className="flex-1 h-11 rounded-md px-3 bg-white text-gray-800" />}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => printToast(dev.connected ? `${dev.name}: связь OK (${dev.fields[1]?.value ?? ''})` : `${dev.name}: не найдено`)}
              className="h-11 px-5 rounded-md bg-pos-blue">Проверить связь</button>
            <button onClick={toggleConnected} className="h-11 px-5 rounded-md bg-white/10 hover:bg-white/20">
              {dev.connected ? 'Отключить' : 'Подключить'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
