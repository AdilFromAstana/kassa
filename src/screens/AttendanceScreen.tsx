import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { attendance as seed } from '../mock/data'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Редактировать явки (ПЕРСОНАЛ → Редактировать явки): журнал прихода/ухода.
export default function AttendanceScreen() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(seed.map((r) => ({ ...r })))

  const setField = (i: number, key: 'in' | 'out', val: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))

  const close = (i: number) => {
    const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    setField(i, 'out', now)
  }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Редактировать явки" />
      <div className="flex-1 overflow-auto p-6">
        <table className="w-full max-w-3xl text-sm">
          <thead className="text-white/50 text-left"><tr>
            <th className="p-2">Сотрудник</th><th>Должность</th><th>Дата</th><th>Приход</th><th>Уход</th><th>Тип явки</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-white/10">
                <td className="p-2">{r.staff}</td>
                <td>{r.position}</td>
                <td>{r.date}</td>
                <td><input value={r.in} onChange={(e) => setField(i, 'in', e.target.value)} className="w-20 h-8 rounded px-2 text-gray-800" placeholder="--:--" /></td>
                <td><input value={r.out} onChange={(e) => setField(i, 'out', e.target.value)} className="w-20 h-8 rounded px-2 text-gray-800" placeholder="--:--" /></td>
                <td className={r.type === 'Прогул' ? 'text-pos-rose' : ''}>{r.type}</td>
                <td>{!r.out && r.in && <button onClick={() => close(i)} className="text-xs bg-pos-blue px-2 py-1 rounded">Закрыть явку</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-4">
        <BackButton onClick={() => navigate('/menu')} />
        <button onClick={() => { printToast('Табель учёта рабочего времени (форма РК)'); }} className="ml-auto h-12 px-6 rounded-md bg-pos-blue text-white">Печать табеля</button>
      </div>
    </div>
  )
}
