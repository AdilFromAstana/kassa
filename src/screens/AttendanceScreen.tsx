import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Check, UserRound } from 'lucide-react'
import { attendance as seed } from '../mock/data'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Редактировать явки (ПЕРСОНАЛ → Редактировать явки): журнал прихода/ухода,
// приём явки, типы (отработано/прогул/отпуск/больничный), добавление/удаление, переход на личную страницу.
type Row = { staff: string; position: string; date: string; in: string; out: string; type: string; accepted: boolean }
const TYPES = ['Отработано', 'Прогул', 'Отпуск', 'Больничный']

export default function AttendanceScreen() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>(seed.map((r) => ({ ...r, accepted: false })))

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const closeShift = (i: number) => set(i, { out: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })
  const addRow = () => setRows((rs) => [...rs, { staff: '', position: '', date: 'Сегодня', in: '', out: '', type: 'Отработано', accepted: false }])
  const delRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Редактировать явки" />
      <div className="flex-1 overflow-auto p-6">
        <table className="w-full max-w-4xl text-sm">
          <thead className="text-white/50 text-left"><tr>
            <th className="p-2">Сотрудник</th><th>Должность</th><th>Дата</th><th>Приход</th><th>Уход</th><th>Тип явки</th><th>Статус</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/10">
                <td className="p-2"><input value={r.staff} onChange={(e) => set(i, { staff: e.target.value })} className="w-36 h-8 rounded px-2 text-gray-800" placeholder="ФИО" /></td>
                <td><input value={r.position} onChange={(e) => set(i, { position: e.target.value })} className="w-28 h-8 rounded px-2 text-gray-800" placeholder="должность" /></td>
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
