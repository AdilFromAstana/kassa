import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { Megaphone, Calendar } from 'lucide-react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'

// Личная страница (iikoFront): результат работы по датам + итоги месяца (ЛП/СПЧ) + управление личной сменой.
export default function PersonalPageScreen() {
  const navigate = useNavigate()
  const { user, personalShift, closedOrders, closePersonalShift } = usePos()

  const myClosed = closedOrders.filter((o) => o.waiter === user?.name)
  const personalSales = myClosed.reduce((s, o) => s + o.total, 0) // ЛП — личные продажи
  const avg = myClosed.length ? personalSales / myClosed.length : 0

  // результат по датам
  const byDate: Record<string, { sales: number; count: number }> = {}
  for (const o of myClosed) {
    const d = o.paidAt.split(',')[0].trim()
    ;(byDate[d] ??= { sales: 0, count: 0 })
    byDate[d].sales += o.total
    byDate[d].count += 1
  }
  const dateRows = Object.entries(byDate)

  // отработано часов (от открытия личной смены до сейчас) → СПЧ (средние продажи в час)
  const toMin = (s?: string) => { const t = s?.split(',')[1]?.trim(); if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const nowD = new Date()
  const openedMin = toMin(personalShift?.openedAt)
  const hours = openedMin != null ? Math.max(0.5, (nowD.getHours() * 60 + nowD.getMinutes() - openedMin) / 60) : 0
  const perHour = hours > 0 ? personalSales / hours : 0

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Личная страница" />
      <div className="flex-1 overflow-auto p-6 flex gap-6">
        <div className="w-64 bg-white/5 rounded-lg p-4 shrink-0">
          <div className="text-pos-accent text-sm uppercase mb-2">Новости</div>
          <div className="text-sm text-white/70 space-y-3">
            <p className="flex items-start gap-2"><Megaphone size={15} className="mt-0.5 shrink-0" /> Мотивационная программа «Капучино-челлендж»: бонус за продажи кофе.</p>
            <p className="flex items-start gap-2"><Calendar size={15} className="mt-0.5 shrink-0" /> План продаж на месяц обновлён.</p>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-lg mb-1">{user?.name}</div>
          <div className="text-sm text-white/60 mb-4">
            {personalShift ? `Личная смена открыта: ${personalShift.openedAt} · должность: ${personalShift.position}` : 'Личная смена закрыта'}
          </div>

          {/* результат работы по датам */}
          <div className="text-pos-accent text-sm uppercase mb-2">Результат работы по датам</div>
          <div className="bg-white/5 rounded-lg overflow-hidden mb-6 max-w-xl">
            {dateRows.length === 0 ? <div className="p-3 text-white/40 text-sm">Нет закрытых чеков.</div> : (
              <table className="w-full text-sm">
                <thead className="text-white/50 text-left"><tr><th className="p-2">Дата</th><th className="text-right">Продажи</th><th className="text-right">Чеков</th><th className="text-right p-2">Средний чек</th></tr></thead>
                <tbody>
                  {dateRows.map(([d, v]) => (
                    <tr key={d} className="border-t border-white/10">
                      <td className="p-2">{d}</td>
                      <td className="text-right">{formatTenge(v.sales)}</td>
                      <td className="text-right">{v.count}</td>
                      <td className="text-right p-2">{formatTenge(v.sales / v.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* итоги текущего месяца */}
          <div className="text-pos-accent text-sm uppercase mb-2">Итоги текущего месяца</div>
          <div className="grid grid-cols-4 gap-4 mb-6 max-w-2xl">
            <Stat label="Личные продажи (ЛП)" value={formatTenge(personalSales)} />
            <Stat label="Закрыто чеков" value={String(myClosed.length)} />
            <Stat label="Средний чек" value={formatTenge(avg)} />
            <Stat label="Сред. продажи в час (СПЧ)" value={formatTenge(perHour)} />
          </div>

          <div className="bg-white/5 rounded-lg p-4 max-w-md">
            <div className="text-pos-accent text-sm uppercase mb-2">Начисления (мок)</div>
            <Row k="Бонусы" v="12 000 ₸" />
            <Row k="Повременная оплата" v="48 000 ₸" />
            <Row k="Штрафы" v="0 ₸" />
            <Row k="Итого" v="60 000 ₸" bold />
          </div>
        </div>
      </div>
      <div className="h-16 bg-white flex items-center px-4 gap-4">
        <BackButton onClick={() => navigate('/menu')} />
        <button onClick={() => { closePersonalShift(); navigate('/') }}
          className="ml-auto h-12 px-8 rounded-md bg-pos-blue text-white">ЗАКРЫТЬ ЛИЧНУЮ СМЕНУ</button>
      </div>
    </div>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white/5 rounded-lg p-4">
    <div className="text-xs text-white/50">{label}</div>
    <div className="text-xl font-bold">{value}</div>
  </div>
)
const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between py-1 ${bold ? 'font-bold border-t border-white/10 mt-1' : 'text-white/70'}`}><span>{k}</span><span>{v}</span></div>
)
