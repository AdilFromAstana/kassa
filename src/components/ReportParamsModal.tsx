import { useState } from 'react'
import CalendarModal from './CalendarModal'

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const fmt = (d: Date) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`

// Экран параметров отчёта (FRONT_03) — 1:1 с iikoFront: слева «Настройки» → плитка «Период»,
// справа «Начало периода / Конец периода» (тап по дате → CalendarModal). Снизу НАЗАД · ОК · Отмена · ДАЛЕЕ.
export default function ReportParamsModal({
  title,
  from,
  to,
  onOk,
  onCancel,
}: {
  title: string
  from: Date
  to: Date
  onOk: (from: Date, to: Date) => void
  onCancel: () => void
}) {
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  const [picking, setPicking] = useState<null | 'from' | 'to'>(null)

  const Field = ({ label, value, onClick }: { label: string; value: Date; onClick: () => void }) => (
    <div className="flex-1">
      <div className="text-pos-accent text-center text-lg mb-3">{label}</div>
      <button
        onClick={onClick}
        className="w-full h-20 bg-white text-gray-800 text-lg rounded shadow flex items-center justify-center hover:ring-2 hover:ring-pos-accent"
      >
        {fmt(value)}
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-[#3d3d3d] flex flex-col">
      <div className="text-center text-white text-2xl uppercase tracking-wide pt-8">{title}</div>
      <div className="text-center text-white/70 mt-3">Укажите период для формирования отчета</div>

      <div className="flex-1 flex items-start gap-12 px-16 pt-20">
        {/* Настройки */}
        <div className="w-72">
          <div className="text-pos-accent text-xl mb-4">Настройки</div>
          <div className="h-28 bg-pos-accent text-gray-900 rounded flex items-center justify-center text-lg">Период</div>
        </div>
        {/* Поля периода */}
        <div className="flex-1 flex gap-12 pt-10">
          <Field label="Начало периода" value={f} onClick={() => setPicking('from')} />
          <Field label="Конец периода" value={t} onClick={() => setPicking('to')} />
        </div>
      </div>

      {/* нижняя панель */}
      <div className="bg-[#23262a] flex items-center px-10 py-5 text-white">
        <button onClick={onCancel} className="flex items-center gap-2 text-white/60 text-lg hover:text-white">
          <span className="text-2xl leading-none">‹</span> НАЗАД
        </button>
        <div className="mx-auto flex items-center gap-12">
          <button onClick={() => onOk(f, t)} className="text-xl font-bold px-6">ОК</button>
          <button onClick={onCancel} className="text-xl px-6">Отмена</button>
        </div>
        <button disabled className="flex items-center gap-2 text-white/30 text-lg cursor-default">
          ДАЛЕЕ <span className="text-2xl leading-none">›</span>
        </button>
      </div>

      {picking && (
        <CalendarModal
          value={picking === 'from' ? f : t}
          onOk={(d) => { if (picking === 'from') setF(d); else setT(d); setPicking(null) }}
          onCancel={() => setPicking(null)}
        />
      )}
    </div>
  )
}
