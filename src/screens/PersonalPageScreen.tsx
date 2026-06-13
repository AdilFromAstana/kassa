import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { Megaphone, Calendar, Trophy } from 'lucide-react'
import { usePos, lineTotal, DEFAULT_OKLAD, DEFAULT_HOUR_RATE, defaultPayMode } from '../store/pos'
import { findDish } from '../mock/menu'
import { attendance } from '../mock/data'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'

// Личная страница (iikoFront): результат работы по датам + итоги месяца (ЛП/СПЧ) + мотивация + управление личной сменой.
export default function PersonalPageScreen() {
  const navigate = useNavigate()
  const { user, personalShift, closedOrders, closePersonalShift, openPersonalShift, motivationPrograms, salaryDeductions, payProfiles } = usePos()

  // профиль оплаты сотрудника — те же значения, что выставил офис (из стора)
  const profile = (user && payProfiles[user.id]) || {}
  const payMode = profile.mode ?? defaultPayMode(user?.positions ?? [])
  const hourRate = profile.rate ?? DEFAULT_HOUR_RATE
  const oklad = profile.oklad ?? DEFAULT_OKLAD

  // отработанные часы из явок (тот же справочник, что и в офисной зарплате) → повременная оплата
  const hhmm2min = (t?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec((t ?? '').trim()); return m ? +m[1] * 60 + +m[2] : null }
  const nowMinutes = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })()
  const myHours = +(attendance.filter((a) => a.staff === user?.name && a.type === 'Отработано')
    .reduce((s, a) => { const i = hhmm2min(a.in); return i == null ? s : s + Math.max(0, (hhmm2min(a.out) ?? nowMinutes) - i) }, 0) / 60).toFixed(1)

  const myClosed = closedOrders.filter((o) => o.waiter === user?.name)
  const personalSales = myClosed.reduce((s, o) => s + o.total, 0) // ЛП — личные продажи
  const avg = myClosed.length ? personalSales / myClosed.length : 0

  // прогресс по мотивационным программам: квалифицирующие продажи сотрудника + начисленная премия
  const myLines = myClosed.flatMap((o) => o.lines)
  const motivation = motivationPrograms.filter((m) => m.active).map((m) => {
    const lines = myLines.filter((l) => m.scope === 'all'
      || (m.scope === 'dish' && l.dishId === m.targetId)
      || (m.scope === 'group' && findDish(l.dishId)?.groupId === m.targetId))
    const qty = lines.reduce((s, l) => s + l.qty, 0)
    const revenue = lines.reduce((s, l) => s + lineTotal(l), 0)
    const reached = !m.minQty || qty >= m.minQty
    const earned = reached ? (m.mode === 'percent' ? +(revenue * m.value / 100).toFixed(0) : qty * m.value) : 0
    const progress = m.minQty ? Math.min(1, qty / m.minQty) : (qty > 0 ? 1 : 0)
    return { m, qty, revenue, earned, reached, progress }
  })
  const motivationTotal = motivation.reduce((s, x) => s + x.earned, 0)

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

          {/* прогресс мотивации */}
          <div className="text-pos-accent text-sm uppercase mb-2 flex items-center gap-2"><Trophy size={15} />Прогресс мотивации</div>
          <div className="bg-white/5 rounded-lg p-4 mb-6 max-w-2xl space-y-3">
            {motivation.length === 0 && <div className="text-white/40 text-sm">Активных программ нет.</div>}
            {motivation.map(({ m, qty, earned, reached, progress }) => (
              <div key={m.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{m.name} <span className="text-white/40">· {m.mode === 'percent' ? `${m.value}%` : `${formatTenge(m.value)}/шт`}</span></span>
                  <span className={reached ? 'text-pos-green font-medium' : 'text-white/50'}>{formatTenge(earned)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full ${reached ? 'bg-pos-green' : 'bg-pos-accent'}`} style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  {m.minQty ? `продано ${qty} из ${m.minQty} (порог премии)` : `продано ${qty} шт`}
                </div>
              </div>
            ))}
            {motivation.length > 0 && (
              <div className="flex justify-between border-t border-white/10 pt-2 font-bold"><span>Премия к начислению</span><span className="text-pos-green">{formatTenge(motivationTotal)}</span></div>
            )}
          </div>

          {(() => {
            const base = payMode === 'hourly' ? Math.round(myHours * hourRate) : oklad
            const fines = salaryDeductions.filter((d) => d.staffId === user?.id).reduce((s, d) => s + d.amount, 0)
            const total = +(base + motivationTotal - fines).toFixed(0)
            return (
              <div className="bg-white/5 rounded-lg p-4 max-w-md">
                <div className="text-pos-accent text-sm uppercase mb-2">Начисления (из явок и продаж)</div>
                {payMode === 'hourly'
                  ? <Row k={`Повременная (${myHours} ч × ${formatTenge(hourRate)})`} v={formatTenge(base)} />
                  : <Row k="Оклад" v={formatTenge(base)} />}
                <Row k="Премия за продажи" v={formatTenge(motivationTotal)} />
                <Row k="Штрафы" v={fines > 0 ? '− ' + formatTenge(fines) : formatTenge(0)} />
                <Row k="Итого начислено" v={formatTenge(total)} bold />
              </div>
            )
          })()}
        </div>
      </div>
      <div className="h-16 bg-white flex items-center px-4 gap-4">
        <BackButton onClick={() => navigate('/menu')} />
        {personalShift ? (
          <button onClick={() => { closePersonalShift(); navigate('/') }}
            className="ml-auto h-12 px-8 rounded-md bg-pos-blue text-white">ЗАКРЫТЬ ЛИЧНУЮ СМЕНУ</button>
        ) : (
          <button onClick={() => { openPersonalShift(user?.positions[0] ?? 'Официант'); navigate('/menu') }}
            className="ml-auto h-12 px-8 rounded-md bg-pos-green text-white">ОТКРЫТЬ ЛИЧНУЮ СМЕНУ</button>
        )}
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
