import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { Megaphone, Calendar } from 'lucide-react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import TopBar from '../components/TopBar'

// Личная страница: итоги работы + управление личной сменой.
export default function PersonalPageScreen() {
  const navigate = useNavigate()
  const { user, personalShift, closedOrders, closePersonalShift } = usePos()

  const myClosed = closedOrders.filter((o) => o.waiter === user?.name)
  const personalSales = myClosed.reduce((s, o) => s + o.total, 0)

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Личная страница" />
      <div className="flex-1 overflow-auto p-6 flex gap-6">
        <div className="w-64 bg-white/5 rounded-lg p-4">
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

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Личные продажи" value={formatTenge(personalSales)} />
            <Stat label="Закрыто чеков" value={String(myClosed.length)} />
            <Stat label="Средний чек" value={formatTenge(myClosed.length ? personalSales / myClosed.length : 0)} />
          </div>

          <div className="bg-white/5 rounded-lg p-4 max-w-md">
            <div className="text-pos-accent text-sm uppercase mb-2">Заработано (мок)</div>
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
