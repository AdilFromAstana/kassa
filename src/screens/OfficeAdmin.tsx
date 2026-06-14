import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { usePos } from '../store/pos'
import { printToast } from '../lib/print'
import { todayISO, addDaysISO, formatRu } from '../lib/date'
import Tabs from '../components/Tabs'

// Администрирование (модуль 12): лицензии, шаблоны печатных форм, устройства ввода, обслуживание БД.
const FinRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-0.5 text-sm"><span className="text-gray-500">{k}</span><span>{v}</span></div>
)

export default function OfficeAdmin() {
  const { licenseClientId, licenses, printTemplates, inputDevices, setLicenseClientId, addLicense, removeLicense, addPrintTemplate, removePrintTemplate, addInputDevice, removeInputDevice } = usePos()
  const [adminTab, setAdminTab] = useState<'license' | 'print' | 'devices' | 'db'>('license')
  const [newTpl, setNewTpl] = useState({ name: '', type: 'Чек' })
  const [newDev, setNewDev] = useState({ name: '', type: 'Сканер штрихкода', group: 'pos' as 'keyboard' | 'pos' })

  return (
    <div className="p-6 max-w-4xl">
      <div className="text-xs text-gray-500 mb-4">Администрирование (модуль 12) — системные настройки: лицензии, шаблоны печатных форм, устройства ввода, обслуживание БД.</div>
      <Tabs active={adminTab} onChange={setAdminTab} items={[
        { id: 'license', label: 'Лицензии' }, { id: 'print', label: 'Печатные формы' }, { id: 'devices', label: 'Устройства ввода' }, { id: 'db', label: 'Обслуживание БД' },
      ]} />

      {adminTab === 'license' && (
        <>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <label className="flex flex-col text-xs text-gray-500">Клиентский ID
              <input value={licenseClientId} onChange={(e) => setLicenseClientId(e.target.value)} className="mt-1 h-9 w-64 rounded border border-gray-300 px-2 font-mono" />
            </label>
            <div className="text-xs text-gray-400">Лицензия проверяется ежедневно онлайн; без интернета — до 30 дней.</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Модуль</th><th className="text-right">Количество</th><th>Действует с</th><th>по</th><th className="p-2"></th></tr></thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2">{l.module}</td>
                    <td className="text-right">{l.count}</td>
                    <td className="text-gray-500">{formatRu(l.from)}</td>
                    <td className="text-gray-500">{formatRu(l.to)}</td>
                    <td className="p-2 text-right"><button onClick={() => removeLicense(l.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addLicense({ module: 'Новый модуль', count: 1, from: todayISO(), to: addDaysISO(todayISO(), 365) })} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm inline-flex items-center gap-1"><Plus size={14} />Добавить лицензию</button>
        </>
      )}

      {adminTab === 'print' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Шаблон</th><th>Тип модели</th><th>Вид</th><th className="p-2 text-right">Действия</th></tr></thead>
              <tbody>
                {printTemplates.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2">{t.name}</td>
                    <td className="text-gray-500">{t.type}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-full ${t.kind === 'standard' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{t.kind === 'standard' ? 'стандартный' : 'пользовательский'}</span></td>
                    <td className="p-2 text-right">
                      <button onClick={() => printToast(`Шаблон «${t.name}» открыт в дизайнере (Stimulsoft, мок)`)} className="text-xs text-blue-600 hover:underline mr-3">Открыть</button>
                      {t.kind === 'custom' ? <button onClick={() => removePrintTemplate(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button> : <span className="text-gray-300 text-xs">встроенный</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-end gap-2">
            <input value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} placeholder="Имя шаблона" className="h-9 rounded border border-gray-300 px-2 flex-1" />
            <select value={newTpl.type} onChange={(e) => setNewTpl({ ...newTpl, type: e.target.value })} className="h-9 rounded border border-gray-300 px-2">
              {['Чек', 'Пречек', 'Товарный чек', 'Z-отчёт', 'Приходная накладная', 'Акт списания', 'Сервисный чек'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <button onClick={() => { if (newTpl.name.trim()) { addPrintTemplate(newTpl.name.trim(), newTpl.type); setNewTpl({ name: '', type: 'Чек' }) } }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Создать</button>
          </div>
        </>
      )}

      {adminTab === 'devices' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Устройство</th><th>Тип</th><th>Группа</th><th className="p-2"></th></tr></thead>
              <tbody>
                {inputDevices.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2">{d.name}</td>
                    <td className="text-gray-500">{d.type}</td>
                    <td className="text-gray-500 text-xs">{d.group === 'pos' ? 'POS' : 'Клавиатурные'}</td>
                    <td className="p-2 text-right"><button onClick={() => removeInputDevice(d.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-end gap-2">
            <input value={newDev.name} onChange={(e) => setNewDev({ ...newDev, name: e.target.value })} placeholder="Название устройства" className="h-9 rounded border border-gray-300 px-2 flex-1" />
            <select value={newDev.type} onChange={(e) => setNewDev({ ...newDev, type: e.target.value })} className="h-9 rounded border border-gray-300 px-2">
              {['Сканер штрихкода', 'Считыватель магнитных карт', 'Клавиатура', 'WaiterLock'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={newDev.group} onChange={(e) => setNewDev({ ...newDev, group: e.target.value as 'keyboard' | 'pos' })} className="h-9 rounded border border-gray-300 px-2">
              <option value="keyboard">Клавиатурные</option><option value="pos">POS</option>
            </select>
            <button onClick={() => { if (newDev.name.trim()) { addInputDevice({ name: newDev.name.trim(), type: newDev.type, group: newDev.group }); setNewDev({ name: '', type: 'Сканер штрихкода', group: 'pos' }) } }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить</button>
          </div>
        </>
      )}

      {adminTab === 'db' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-gray-500 text-xs uppercase mb-2">Статус бэкапов</div>
            <FinRow k="Полный бэкап" v="OK · сегодня 03:00" />
            <FinRow k="Бэкап логов" v="OK · каждые 15 мин" />
            <FinRow k="Режим восстановления" v="Full recovery" />
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-gray-500 text-xs uppercase mb-2">Информация о БД</div>
            <FinRow k="Размер данных" v="412 МБ" />
            <FinRow k="Размер индексов" v="88 МБ" />
            <FinRow k="Лог-файл" v="36 МБ" />
            <FinRow k="Свободно на диске" v="64 ГБ" />
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-4 col-span-2">
            <div className="text-gray-500 text-xs uppercase mb-2">Сервис</div>
            <div className="flex flex-wrap gap-2">
              {['Произвести бэкап сейчас', 'Перестроить индексы', 'Очистить лог транзакций', 'Сжать БД', 'Перезапустить сервер БД'].map((b) => (
                <button key={b} onClick={() => printToast(`${b} — выполнено (мок)`)} className="h-9 px-3 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100">{b}</button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">⚠️ «Сжать БД» может повысить фрагментацию; «Очистить лог» в режиме Full требует последующего полного бэкапа.</div>
          </div>
        </div>
      )}
    </div>
  )
}
