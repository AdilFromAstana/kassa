import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Check, UserRound } from 'lucide-react'
import { attendance as seed } from '../mock/data'
import { usePos } from '../store/pos'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Редактировать явки (ПЕРСОНАЛ → Редактировать явки): журнал прихода/ухода,
// приём явки, типы (отработано/прогул/отпуск/больничный), добавление/удаление, переход на личную страницу.
// Сотрудник выбирается из справочника (не свободный ввод), есть фильтр по дате и сотруднику.
type Row = { staff: string; position: string; date: string; in: string; out: string; type: string; accepted: boolean }
const TYPES = ['Отработано', 'Прогул', 'Отпуск', 'Больничный']

export default function AttendanceScreen() {
  const navigate = useNavigate()
  const staff = usePos((s) => s.staffList)
  const [rows, setRows] = useState<Row[]>(seed.map((r) => ({ ...r, accepted: false })))
  const [fStaff, setFStaff] = useState('') // фильтр по сотруднику ('' = все)
  const [fDate, setFDate] = useState('')   // фильтр по дате ('' = все)

  const dates = Array.from(new Set(rows.map((r) => r.date)))
  const positionOf = (name: string) => staff.find((s) => s.name === name)?.positions[0] ?? ''

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const setStaff = (i: number, name: string) => set(i, { staff: name, position: positionOf(name) })
  const closeShift = (i: number) => set(i, { out: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })
  const addRow = () => setRows((rs) => [...rs, { staff: staff[0]?.name ?? '', position: staff[0]?.positions[0] ?? '', date: fDate || 'Сегодня', in: '', out: '', type: 'Отработано', accepted: false }])
  const delRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  // отображаем отфильтрованные строки, но правки идут по реальному индексу в rows
  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (!fStaff || r.staff === fStaff) && (!fDate || r.date === fDate))

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Редактировать явки" />
      <div className="flex-1 overflow-auto p-6">
        {/* фильтр-строка: дата + сотрудник */}
        <div className="flex items-end gap-4 mb-4">
          <label>
            <div className="text-white/50 text-xs mb-1">Дата</div>
            <select value={fDate} onChange={(e) => setFDate(e.target.value)} className="h-9 rounded px-2 text-gray-800 min-w-[140px]">
              <option value="">Все даты</option>
              {dates.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            <div className="text-white/50 text-xs mb-1">Сотрудник</div>
            <select value={fStaff} onChange={(e) => setFStaff(e.target.value)} className="h-9 rounded px-2 text-gray-800 min-w-[180px]">
              <option value="">Все сотрудники</option>
              {staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </label>
          {(fStaff || fDate) && <button onClick={() => { setFStaff(''); setFDate('') }} className="h-9 px-3 rounded bg-white/10 text-sm">Сбросить</button>}
        </div>

        <table className="w-full max-w-4xl text-sm">
          <thead className="text-white/50 text-left"><tr>
            <th className="p-2">Сотрудник</th><th>Должность</th><th>Дата</th><th>Приход</th><th>Уход</th><th>Тип явки</th><th>Статус</th><th></th>
          </tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={8} className="p-4 text-white/40">Нет явок по фильтру.</td></tr>}
            {visible.map(({ r, i }) => (
              <tr key={i} className="border-b border-white/10">
                <td className="p-2">
                  <select value={r.staff} onChange={(e) => setStaff(i, e.target.value)} className="w-44 h-8 rounded px-2 text-gray-800">
                    {!staff.some((s) => s.name === r.staff) && <option value={r.staff}>{r.staff || '—'}</option>}
                    {staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </td>
                <td className="text-white/70">{r.position || '—'}</td>
                <td>{r.date}</td>
                <td><input value={r.in} onChange={(e) => set(i, { in: e.target.value })} className="w-20 h-8 rounded px-2 text-gray-800" placeholder="--:--" /></td>
                <td><input value={r.out} onChange={(e) => set(i, { out: e.target.value })} className="w-20 h-8 rounded px-2 text-gray-800" placeholder="--:--" /></td>
                <td>
                  <select value={r.type} onChange={(e) => set(i, { type: e.target.value })}
                    className={`h-8 rounded px-1 text-gray-800 ${r.type === 'Прогул' ? 'text-pos-rose' : ''}`}>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  {r.accepted
                    ? <span className="text-pos-green text-xs inline-flex items-center gap-1"><Check size={13} />принято</span>
                    : <button onClick={() => set(i, { accepted: true })} className="text-xs bg-pos-green text-white px-2 py-1 rounded">Принять явку</button>}
                </td>
                <td className="text-right whitespace-nowrap">
                  {!r.out && r.in && <button onClick={() => closeShift(i)} className="text-xs bg-pos-blue px-2 py-1 rounded mr-2">Закрыть</button>}
                  <button onClick={() => delRow(i)} className="text-white/40 hover:text-pos-rose" title="Удалить явку"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="mt-3 h-9 px-4 rounded-md bg-white/10 hover:bg-white/20 inline-flex items-center gap-2 text-sm"><Plus size={16} />Добавить явку</button>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-3">
        <BackButton onClick={() => navigate('/menu')} />
        <button onClick={() => navigate('/personal')} className="h-12 px-4 rounded-md bg-white/0 border border-gray-300 inline-flex items-center gap-2"><UserRound size={18} />Личная страница</button>
        <button onClick={() => printToast('Табель учёта рабочего времени (форма РК)')} className="ml-auto h-12 px-6 rounded-md bg-pos-blue text-white">Печать табеля</button>
      </div>
    </div>
  )
}
