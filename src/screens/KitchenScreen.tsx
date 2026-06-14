import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Flame, Check, Soup, Clock } from 'lucide-react'
import TopBar from '../components/TopBar'
import BackButton from '../components/BackButton'
import { usePos } from '../store/pos'
import { findDish, stationOf, type Station } from '../mock/menu'
import { findTable } from '../mock/data'
import { minutesSince } from '../lib/date'

// Кухонный экран (KDS / iikoFront «Кухонный экран») — повар видит отправленные на станцию блюда
// по всем открытым заказам, со статусом и таймером ожидания; красный таймер = просрочка (>15′).
// Тап по блюду продвигает статус: Новое → Готовится → Готово → Подано (уходит с экрана).
type KStatus = 'new' | 'cooking' | 'ready' | 'served'
const META: Record<Exclude<KStatus, 'served'>, { label: string; next: string; cls: string; badge: string }> = {
  new: { label: 'Новое', next: 'Готовить', cls: 'border-gray-300 bg-white', badge: 'bg-gray-200 text-gray-700' },
  cooking: { label: 'Готовится', next: 'Готово', cls: 'border-amber-300 bg-amber-50', badge: 'bg-amber-400 text-amber-950' },
  ready: { label: 'Готово', next: 'Подать', cls: 'border-emerald-300 bg-emerald-50', badge: 'bg-emerald-500 text-white' },
}

export default function KitchenScreen() {
  const navigate = useNavigate()
  const { orders, cycleKitchenAt, establishment } = usePos()
  const [station, setStation] = useState<'all' | Station>('all')

  // билеты: открытые заказы с блюдами станции, ещё не поданными
  const stationMatch = (gid: string | undefined) => {
    const s = stationOf(gid)
    return s != null && (station === 'all' || s === station)
  }
  const tickets = orders
    .map((o) => ({ o, items: o.lines.filter((l) => l.kitchenStatus && l.kitchenStatus !== 'served' && stationMatch(findDish(l.dishId)?.groupId)) }))
    .filter((t) => t.items.length > 0)
    .map((t) => {
      const wait = Math.max(0, ...t.items.filter((l) => l.kitchenStatus === 'cooking' && l.firedAt).map((l) => minutesSince(l.firedAt!)))
      return { ...t, wait }
    })
    .sort((a, b) => b.wait - a.wait) // самые «горящие» сверху

  const counts = {
    cooking: tickets.reduce((s, t) => s + t.items.filter((l) => l.kitchenStatus === 'cooking').length, 0),
    ready: tickets.reduce((s, t) => s + t.items.filter((l) => l.kitchenStatus === 'ready').length, 0),
  }
  const tableLabel = (o: typeof tickets[number]['o']) =>
    o.tableId ? `Стол ${findTable(o.tableId)?.no ?? o.tableId.replace(/^t-/, '')}` : o.type === 'delivery' ? 'Доставка' : 'Вынос'

  const STATIONS: ['all' | Station, string][] = [['all', 'Все'], ['КУХНЯ', 'Кухня'], ['БАР', 'Бар']]

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Кухонный экран (KDS)" />
      <div className="flex-1 overflow-auto p-4">
        {!establishment.kitchenScreen ? (
          <div className="text-white/50 text-sm p-4">Кухонный экран выключен. Включите «Кухонный экран (KDS)» в настройках заведения (офис → Настройки / Доп.).</div>
        ) : (
          <>
            {/* фильтр станций + счётчики */}
            <div className="flex items-center gap-2 mb-4">
              {STATIONS.map(([id, label]) => (
                <button key={id} onClick={() => setStation(id)}
                  className={`h-9 px-4 rounded-md text-sm ${station === id ? 'bg-pos-accent text-gray-900' : 'bg-white/10 text-white/80'}`}>{label}</button>
              ))}
              <div className="ml-auto flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-amber-300"><Flame size={15} />Готовится: {counts.cooking}</span>
                <span className="flex items-center gap-1 text-emerald-300"><Check size={15} />Готово: {counts.ready}</span>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-white/40 mt-20 gap-2">
                <Soup size={48} /><div>Очередь пуста — все блюда поданы.</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {tickets.map(({ o, items, wait }) => {
                  const overdue = wait > 15
                  return (
                    <div key={o.id} className={`rounded-lg overflow-hidden border-2 ${overdue ? 'border-pos-rose' : 'border-white/10'} bg-[#2b2f31]`}>
                      <div className={`px-3 py-2 flex items-center justify-between ${overdue ? 'bg-pos-rose text-white' : 'bg-black/30'}`}>
                        <div>
                          <div className="font-semibold">{tableLabel(o)} · №{o.id}</div>
                          <div className="text-xs opacity-70">{o.waiter} · открыт {o.openedAt}</div>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-mono ${overdue ? 'text-white' : wait > 10 ? 'text-amber-300' : 'text-white/60'}`}>
                          <Clock size={14} />{wait}′
                        </div>
                      </div>
                      <div className="divide-y divide-white/5">
                        {items.map((l) => {
                          const st = (l.kitchenStatus ?? 'new') as Exclude<KStatus, 'served'>
                          const m = META[st]
                          const mins = l.kitchenStatus === 'cooking' && l.firedAt ? minutesSince(l.firedAt) : null
                          const lateLine = mins != null && mins > 15
                          return (
                            <div key={l.uid} className="px-3 py-2 flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{l.qty}× {l.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${m.badge}`}>{m.label}</span>
                                  {mins != null && <span className={`text-[11px] ${lateLine ? 'text-pos-rose font-semibold' : 'text-white/40'}`}>{lateLine ? `просрочка ${mins}′` : `${mins}′`}</span>}
                                </div>
                              </div>
                              <button onClick={() => cycleKitchenAt(o.id, l.uid)}
                                className={`h-8 px-2.5 rounded text-xs font-medium shrink-0 ${st === 'ready' ? 'bg-emerald-500 text-white' : st === 'cooking' ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-amber-950'}`}>{m.next}</button>
                            </div>
                          )
                        })}
                      </div>
                      {/* быстрое действие: всё, что готовится → готово */}
                      {items.some((l) => l.kitchenStatus === 'cooking') && (
                        <button onClick={() => items.filter((l) => l.kitchenStatus === 'cooking').forEach((l) => cycleKitchenAt(o.id, l.uid))}
                          className="w-full h-9 bg-black/30 hover:bg-black/40 text-emerald-300 text-xs flex items-center justify-center gap-1"><ChefHat size={14} />Всё готово</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
