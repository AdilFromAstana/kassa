import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Home, X, MoreVertical, Scissors, Plus, Receipt, ReceiptText, Users, Menu, Lock, UserRound, Calculator, Power, Printer, MessageSquare } from 'lucide-react'
import { usePos, lineTotal, orderSubtotal, orderTotal, isStopped } from '../store/pos'
import { groupsByPage, dishesByGroup, findDish } from '../mock/menu'
import { dishMaxPortions } from '../mock/warehouse'
import { formatTenge } from '../lib/money'
import { minutesSince } from '../lib/date'
import { printToast } from '../lib/print'
import ModifiersModal from '../components/ModifiersModal'
import TransferModal from '../components/TransferModal'
import SearchModal from '../components/SearchModal'
import QuantityModal from '../components/QuantityModal'
import DiscountModal from '../components/DiscountModal'
import type { Dish, SelectedModifier } from '../types'

// Рабочий экран заказа: гости — вкладками сверху (как в iikoFront). Блюда падают активному гостю.
export default function OrderScreen() {
  const navigate = useNavigate()
  const pos = usePos()
  const order = pos.currentOrder()

  const [page, setPage] = useState<1 | 2 | 3>(1)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [selUid, setSelUid] = useState<string | null>(null)
  const [activeGuest, setActiveGuest] = useState(1)
  const [modDish, setModDish] = useState<Dish | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [moveGuest, setMoveGuest] = useState(false)
  const [guestPay, setGuestPay] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [waiterPick, setWaiterPick] = useState(false)
  const [typePick, setTypePick] = useState(false)
  const [coursePick, setCoursePick] = useState(false)
  const [catPick, setCatPick] = useState(false)
  const [guestCard, setGuestCard] = useState(false)
  const [cardNum, setCardNum] = useState('')
  const loyaltyCard = pos.loyaltyCards.find((c) => c.id === order?.loyaltyCardId)

  useEffect(() => { if (!order) navigate('/halls') }, [order, navigate])
  // при переключении на другой заказ — сбросить активного гостя и выбор
  useEffect(() => { setActiveGuest(1); setSelUid(null) }, [order?.id])
  if (!order) return null

  // переключение открытых заказов в нижней панели (< пред., + новый)
  const prevOrder = () => {
    const open = pos.orders
    if (open.length < 2) return
    const idx = open.findIndex((o) => o.id === order.id)
    pos.openExistingOrder(open[(idx - 1 + open.length) % open.length].id)
  }
  const nextOrder = () => {
    const open = pos.orders
    if (open.length < 2) return
    const idx = open.findIndex((o) => o.id === order.id)
    pos.openExistingOrder(open[(idx + 1) % open.length].id)
  }
  const newOrder = () => pos.startOrder({ tableId: null, hallId: null, guests: 1, type: 'takeaway' })

  const guestOf = (g: number | undefined) => g ?? 1 // legacy undefined → гость 1
  const addDish = (d: Dish) => {
    if (d.modifierGroupIds && d.modifierGroupIds.length) setModDish(d)
    else pos.addDish(d.id, [], activeGuest)
  }
  const onModConfirm = (mods: SelectedModifier[]) => { if (modDish) pos.addDish(modDish.id, mods, activeGuest); setModDish(null) }

  const addGuest = () => { pos.addGuest(order.id); setActiveGuest(order.guests + 1) }

  const [qtyOpen, setQtyOpen] = useState(false)
  const setQtyManual = () => { if (selUid) setQtyOpen(true) }
  const selLine = order.lines.find((l) => l.uid === selUid) ?? null
  // скидка/надбавка — через модалку с офисными скидками + клубной картой (Дисконтная система)
  const setDiscount = () => setShowDiscount(true)
  const setSurcharge = () => setShowDiscount(true)

  // Сервисный чек на кухню/бар (марка/бегунок): весь заказ или выделенная позиция.
  // Роутинг по группе блюда → станция приготовления. Товары/услуги на станцию не печатаются.
  const stationOf = (groupId?: string) => {
    if (groupId && ['g-hot', 'g-nat', 'g-dessert'].includes(groupId)) return 'КУХНЯ'
    if (groupId && ['g-drink', 'g-coffee', 'g-bar'].includes(groupId)) return 'БАР'
    return null
  }
  const printService = () => {
    const src = selUid ? order.lines.filter((l) => l.uid === selUid) : order.lines
    const byStation: Record<string, string[]> = {}
    for (const l of src) {
      const st = stationOf(findDish(l.dishId)?.groupId)
      if (!st) continue
      ;(byStation[st] ??= []).push(`${l.qty}× ${l.name}`)
    }
    const parts = Object.entries(byStation).map(([st, items]) => `${st}:\n${items.join('\n')}`)
    if (!parts.length) { printToast('Нет позиций для кухни/бара'); return }
    // отправка на кухню (KDS): новые позиции со станцией → «готовится» (старт таймера)
    if (est.kitchenScreen) {
      for (const l of src) {
        if (stationOf(findDish(l.dishId)?.groupId) && (!l.kitchenStatus || l.kitchenStatus === 'new')) pos.cycleKitchen(l.uid)
      }
    }
    printToast(`Сервисный чек${selUid ? ' (выделенное)' : ''} · ${tableLabel}\n${parts.join('\n\n')}`)
  }

  const est = pos.establishment
  const isRest = est.mode === 'restaurant' // ресторан: гости/деление/перенос/пречек; фастфуд — нет
  // ярлыки/типы заказов из справочника офиса (Розничные продажи → Типы заказов)
  const defForMode = (m: typeof order.type) => pos.orderTypes.find((o) => o.mode === m && o.isDefault) ?? pos.orderTypes.find((o) => o.mode === m)
  const TYPE_LABEL: Record<string, string> = {
    dinein: defForMode('dinein')?.name ?? 'Зал',
    takeaway: defForMode('takeaway')?.name ?? 'Вынос',
    delivery: defForMode('delivery')?.name ?? 'Доставка',
  }
  const courseList = order.lines.length ? Array.from(new Set(order.lines.map((l) => l.course).filter((c): c is number => !!c))).sort() : []
  const serveCourse = (c: number) => {
    const items = order.lines.filter((l) => l.course === c).map((l) => `${l.qty}× ${l.name}`)
    printToast(items.length ? `Подан курс ${c} · ${tableLabel}\n${items.join('\n')}` : `В курсе ${c} нет позиций`)
  }
  const guestList = Array.from({ length: order.guests }, (_, i) => i + 1)
  const guestLines = order.lines.filter((l) => guestOf(l.guestNo) === activeGuest)
  const guestSum = (g: number) => order.lines.filter((l) => guestOf(l.guestNo) === g).reduce((s, l) => s + lineTotal(l), 0)
  const tableLabel = order.tabName ? `Tab: ${order.tabName}` : order.tableId ? `Стол ${order.tableId.replace(/^t-/, '')}` : 'Не задан'

  const GuestTab = ({ g }: { g: number }) => (
    <button onClick={() => { setActiveGuest(g); setSelUid(null) }}
      className={`min-w-[92px] px-3 flex flex-col items-center justify-center gap-0.5 border-r border-black/20
        ${activeGuest === g ? 'bg-pos-accent text-black' : 'bg-white/5 text-white/80'}`}>
      <UserRound size={20} /><span className="text-xs">ГОСТЬ {g}</span>
    </button>
  )

  return (
    <div className="h-full flex flex-col bg-pos-bg">
      {/* ВЕРХ: вкладки гостей (ресторан) + меню/замок */}
      <div className="h-16 bg-[#2b2b2b] flex items-stretch shrink-0">
        {isRest && (
          <button onClick={addGuest} className="min-w-[80px] px-3 flex flex-col items-center justify-center gap-0.5 text-white/80 border-r border-black/20 active:bg-white/10">
            <Plus size={20} /><span className="text-xs">ГОСТЬ</span>
          </button>
        )}
        <div className="flex-1 flex items-stretch overflow-x-auto">
          {isRest && guestList.map((g) => <GuestTab key={g} g={g} />)}
        </div>
        <div className="flex items-center gap-4 px-4 text-white">
          <button onClick={() => navigate('/menu')} title="Доп. меню"><Menu size={22} /></button>
          <button onClick={() => { pos.logout(); navigate('/') }} title="Заблокировать"><Lock size={18} /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ЛЕВО: заказ активного гостя */}
        <div className="w-[38%] bg-pos-panel flex flex-col">
          <div className="bg-pos-blue text-white px-3 py-2 text-sm flex items-center gap-2">
            <Receipt size={15} /><span>{order.openedAt}</span>
            <span>· {tableLabel}</span>
            <span className="px-1.5 rounded bg-black/20 text-xs">{TYPE_LABEL[order.type]}</span>
            {pos.activePriceCategory !== 'base' && <span className="px-1.5 rounded bg-amber-500/80 text-gray-900 text-xs">{pos.priceCategories.find((c) => c.id === pos.activePriceCategory)?.name}</span>}
            {loyaltyCard && <span className="px-1.5 rounded bg-pink-500/80 text-white text-xs">★ {loyaltyCard.owner} · {formatTenge(loyaltyCard.balance)}</span>}
            <span className="flex items-center gap-1">· <Users size={15} /> {order.guests}</span>
            <span className="ml-auto">{order.waiter}</span>
          </div>

          {isRest && <div className="bg-pos-accent/70 text-gray-900 text-center text-sm font-medium py-1">Гость {activeGuest}</div>}

          <div className="flex-1 overflow-auto">
            {guestLines.length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">{isRest ? `У гостя ${activeGuest} пусто — выберите блюда` : 'Заказ пуст — выберите блюда'}</div>}
            {guestLines.map((l, i) => (
              <div key={l.uid} onClick={() => setSelUid(l.uid)}
                className={`px-3 py-1.5 border-b border-gray-200 cursor-pointer ${selUid === l.uid ? 'bg-pos-accent' : ''}`}>
                <div className="flex justify-between items-baseline">
                  <span><span className="text-gray-400 mr-2">{i + 1}</span>{l.name}{l.qty !== 1 && <span className="text-gray-500"> × {String(l.qty).replace('.', ',')}</span>}{l.course ? <span className="ml-1.5 text-[10px] bg-pos-blue text-white rounded px-1 align-middle">К{l.course}</span> : null}{l.discountPct ? <span className="ml-1.5 text-[10px] bg-emerald-600 text-white rounded px-1 align-middle">−{l.discountPct}%</span> : null}</span>
                  <span className="font-medium">{formatTenge(lineTotal(l))}</span>
                </div>
                {l.modifiers.length > 0 && (
                  <div className="text-xs text-gray-500 italic pl-6">
                    {l.modifiers.map((m) => m.name + (m.qty > 1 ? `×${m.qty}` : '')).join(', ')}
                  </div>
                )}
                {l.comment && <div className="text-xs text-pos-blue italic pl-6 flex items-center gap-1"><MessageSquare size={11} />{l.comment}</div>}
                {est.kitchenScreen && l.kitchenStatus && l.kitchenStatus !== 'new' && (() => {
                  const overdue = l.kitchenStatus === 'cooking' && l.firedAt && minutesSince(l.firedAt) > 15
                  const meta: Record<string, { t: string; c: string }> = {
                    cooking: { t: 'готовится', c: 'bg-amber-400 text-gray-900' },
                    ready: { t: 'готово', c: 'bg-pos-green text-white' },
                    served: { t: 'подано', c: 'bg-pos-blue text-white' },
                  }
                  const m = meta[l.kitchenStatus]
                  return (
                    <div className="pl-6 mt-0.5 flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); pos.cycleKitchen(l.uid) }}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${m.c}`}>{m.t}</button>
                      {l.kitchenStatus === 'cooking' && l.firedAt && (
                        <span className={`text-[10px] ${overdue ? 'text-pos-rose font-semibold' : 'text-gray-400'}`}>
                          {overdue ? `⏱ просрочка ${minutesSince(l.firedAt)}′` : `⏱ ${minutesSince(l.firedAt)}′`}
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* итоги (по всему заказу) */}
          <div className="border-t border-gray-300 px-3 py-2 text-sm">
            {isRest && <div className="flex justify-between text-gray-500"><span>Гость {activeGuest}</span><span>{formatTenge(guestSum(activeGuest))}</span></div>}
            <div className="flex justify-between text-gray-500"><span>Скидка / Надбавка</span><span>{order.discountPct.toFixed(2)}% / {order.surchargePct.toFixed(2)}%</span></div>
            {order.discountAmount ? <div className="flex justify-between text-gray-500"><span>Скидка суммой</span><span>− {formatTenge(order.discountAmount)}</span></div> : null}
            <div className="flex justify-between text-gray-500"><span>подытог (весь заказ)</span><span>{formatTenge(orderSubtotal(order))}</span></div>
            <div className="flex justify-between text-2xl font-bold mt-1"><span>ИТОГО</span><span>{formatTenge(orderTotal(order))}</span></div>
          </div>

          {/* действия над позицией: + − 123 [ножницы — ресторан] ⋮ ✕ */}
          <div className={`h-14 bg-gray-100 border-t border-gray-300 grid ${isRest ? 'grid-cols-6' : 'grid-cols-5'}`}>
            <button className="pad-key rounded-none border-0 text-2xl" onClick={() => selUid && pos.incLine(selUid)}>+</button>
            <button className="pad-key rounded-none border-0 text-2xl" onClick={() => selUid && pos.decLine(selUid)}>−</button>
            <button className="pad-key rounded-none border-0 text-base" onClick={setQtyManual}>123</button>
            {isRest && <button className="pad-key rounded-none border-0 flex items-center justify-center disabled:opacity-30" disabled={!selUid} onClick={() => setMoveGuest(true)} title="Перенести гостю"><Scissors size={18} /></button>}
            <button className="pad-key rounded-none border-0 flex items-center justify-center" onClick={() => setShowMore(true)} title="Действия"><MoreVertical size={20} /></button>
            <button className="pad-key rounded-none border-0 flex items-center justify-center" onClick={() => selUid && (pos.removeLine(selUid), setSelUid(null))} title="Удалить"><X size={20} /></button>
          </div>
        </div>

        {/* ЦЕНТР+ПРАВО: быстрое меню. Верхний тулбар — грид 6 ячеек: ← 🔍 🏠 I II III */}
        <div className="flex-1 flex flex-col bg-pos-bg">
          <div className="grid grid-cols-6 gap-1 p-1 bg-black/30">
            <button onClick={() => setGroupId(null)} title="К группам" className="h-12 flex items-center justify-center rounded bg-white/10 text-white active:bg-white/20"><ChevronLeft size={22} /></button>
            <button onClick={() => setShowSearch(true)} title="Поиск" className="h-12 flex items-center justify-center rounded bg-white/10 text-white active:bg-white/20"><Search size={20} /></button>
            <button onClick={() => setGroupId(null)} title="В начало" className="h-12 flex items-center justify-center rounded bg-white/10 text-white active:bg-white/20"><Home size={20} /></button>
            {([1, 2, 3] as const).map((p) => (
              <button key={p} onClick={() => { setPage(p); setGroupId(null) }}
                className={`h-12 rounded text-lg font-medium ${page === p ? 'bg-pos-accent text-black' : 'bg-white/10 text-white active:bg-white/20'}`}>
                {p === 1 ? 'I' : p === 2 ? 'II' : 'III'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-1">
            <div className="grid grid-cols-3 gap-1 auto-rows-[6rem]">
              {groupId === null
                ? groupsByPage(page).map((g) => (
                    <button key={g.id} className="tile tile-group" onClick={() => setGroupId(g.id)}>{g.name}</button>
                  ))
                : dishesByGroup(groupId).map((d) => {
                    const manualStop = isStopped(pos.stopList, d.id, order.hallId)
                    const max = dishMaxPortions(d.id, pos.ingredients, pos.techCardOverrides) // ∞ — без техкарты
                    const outOfStock = max <= 0
                    const stopped = manualStop || outOfStock
                    const low = !stopped && max !== Infinity && max <= 5
                    return (
                      <button key={d.id} disabled={stopped} className={`tile relative ${stopped ? 'opacity-40 cursor-not-allowed' : ''}`}
                        style={{ background: d.color ?? '#e9e4d8' }} onClick={() => addDish(d)}>
                        <span className="tile-dish">{d.name}<br /><span className="opacity-70">{formatTenge(pos.priceOf(d.id, d.price))}</span></span>
                        {stopped && <span className="absolute top-1 right-1 text-[10px] bg-pos-rose text-gray-900 rounded px-1">{manualStop ? 'стоп' : 'нет'}</span>}
                        {low && <span className="absolute top-1 right-1 text-[10px] bg-amber-400 text-gray-900 rounded px-1">{max} шт</span>}
                      </button>
                    )
                  })}
            </div>
          </div>
        </div>
      </div>

      {/* нижняя панель: НАЗАД · ЗАКРЫТЫЕ ЗАКАЗЫ · (центр) < + · действия · КАССА · выкл */}
      <div className="h-16 bg-[#1a1a1a] text-white flex items-center px-4 gap-5 shrink-0">
        <button onClick={() => navigate('/halls')} className="flex flex-col items-center gap-0.5 text-[11px]"><ChevronLeft size={22} />НАЗАД</button>
        <button onClick={() => navigate('/orders/closed')} className="flex flex-col items-center gap-0.5 text-[11px]"><ReceiptText size={20} />ЗАКРЫТЫЕ ЗАКАЗЫ</button>

        {/* центр: переключение/создание заказов */}
        <div className="mx-auto flex items-center gap-3">
          <button onClick={prevOrder} disabled={pos.orders.length < 2} title="Предыдущий заказ"
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30 active:bg-white/20"><ChevronLeft size={22} /></button>
          <span className="text-xs text-white/50 min-w-[3rem] text-center">{pos.orders.findIndex((o) => o.id === order.id) + 1} / {pos.orders.length}</span>
          <button onClick={nextOrder} disabled={pos.orders.length < 2} title="Следующий заказ"
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30 active:bg-white/20"><ChevronRight size={22} /></button>
          <button onClick={newOrder} title="Новый заказ (быстрый чек)"
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"><Plus size={22} /></button>
        </div>

        {/* Печать сервисного чека на кухню/бар (весь заказ или выделенное) */}
        <button onClick={printService} disabled={order.lines.length === 0}
          className="flex flex-col items-center gap-0.5 text-[11px] disabled:opacity-30"><Printer size={20} />ПЕЧАТЬ</button>

        {/* Пречек — ресторан + включена печать пречека в профиле (в фастфуде его нет) */}
        {isRest && est.precheck && (
          <button onClick={() => { pos.precheck(); printToast('Пречек (предварительный счёт)') }} disabled={order.lines.length === 0}
            className="flex flex-col items-center gap-0.5 text-[11px] disabled:opacity-30"><Receipt size={20} />ПРЕЧЕК</button>
        )}
        <button onClick={() => navigate('/payment')} disabled={order.lines.length === 0}
          className={`h-12 px-6 rounded-md flex flex-col items-center justify-center gap-0.5 text-xs ${order.lines.length ? 'bg-pos-green text-white' : 'bg-gray-700 text-white/40'}`}>
          <Calculator size={18} />КАССА
        </button>
        <button onClick={() => { pos.logout(); navigate('/') }} className="text-pos-green" title="Заблокировать / выключить"><Power size={22} /></button>
      </div>

      {/* меню «…»: действия с заказом (как в iikoFront) */}
      {showMore && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setShowMore(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-2 w-[320px]" onClick={(e) => e.stopPropagation()}>
            {[
              { label: 'Скидка', on: () => setDiscount(), disabled: !pos.can('F_ID') },
              { label: 'Надбавка', on: () => setSurcharge(), disabled: !pos.can('F_ID') },
              { label: 'Сменить официанта', on: () => setWaiterPick(true), disabled: !pos.can('F_COW') },
              { label: `Тип заказа: ${TYPE_LABEL[order.type]}`, on: () => setTypePick(true), disabled: false },
              ...(est.tab ? [{ label: order.tabName ? `Барный счёт: ${order.tabName}` : 'Открыть барный счёт (Tab)', on: () => { const n = window.prompt('Название барного счёта (имя гостя/карта):', order.tabName ?? ''); if (n != null) pos.setOrderTab(order.id, n.trim() || undefined) }, disabled: false }] : []),
              ...(est.courses ? [{ label: selUid ? 'Курс подачи позиции' : 'Курсы подачи', on: () => setCoursePick(true), disabled: false }] : []),
              { label: `Ценовая категория: ${pos.priceCategories.find((c) => c.id === pos.activePriceCategory)?.name ?? 'Базовая'}`, on: () => setCatPick(true), disabled: false },
              ...(est.iikoCard && pos.loyaltyProgram.active ? [{ label: loyaltyCard ? `Карта гостя: ${loyaltyCard.owner}` : 'Карта гостя (iikoCard)', on: () => { setGuestCard(true); setCardNum('') }, disabled: false }] : []),
              ...(isRest ? [{ label: 'Перенести заказ на стол', on: () => setShowTransfer(true), disabled: false }] : []),
              { label: 'Объединить с другим заказом', on: () => setMergeOpen(true), disabled: pos.orders.length < 2 || !pos.can('F_MPR') },
              ...(isRest && order.guests > 1 ? [{ label: 'Оплата по гостям', on: () => setGuestPay(true), disabled: false }] : []),
              ...(est.comments ? [{ label: selUid ? 'Комментарий к позиции' : 'Комментарий к заказу', on: () => { const c = window.prompt('Комментарий:', (selUid && selLine?.comment) || ''); if (c != null) { if (selUid) pos.setLineComment(selUid, c); else if (c) printToast('Комментарий сохранён') } }, disabled: false }] : []),
            ].map((it) => (
              <button key={it.label} disabled={it.disabled} onClick={() => { setShowMore(false); it.on() }}
                className="w-full text-left px-4 h-12 rounded-md hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between">
                <span>{it.label}</span>{it.disabled && <span className="text-xs text-gray-400">нет права</span>}
              </button>
            ))}
            <button onClick={() => setShowMore(false)} className="w-full text-center px-4 h-11 mt-1 rounded-md bg-gray-200">Закрыть</button>
          </div>
        </div>
      )}

      {/* объединить текущий заказ с другим открытым (mergeOrderInto) */}
      {mergeOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setMergeOpen(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-4 w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-1">Объединить заказ №{order.id}</div>
            <div className="text-sm text-gray-500 mb-3">Позиции перенесутся в выбранный заказ, текущий закроется.</div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {pos.orders.filter((o) => o.id !== order.id).map((o) => (
                <button key={o.id} onClick={() => { pos.mergeOrderInto(order.id, o.id); setMergeOpen(false); printToast(`Заказ №${order.id} объединён с №${o.id}`); navigate('/order') }}
                  className="w-full flex items-center justify-between px-3 h-12 rounded-md bg-gray-100 hover:bg-gray-200">
                  <span>Заказ №{o.id} · {o.tableId ? `стол ${o.tableId.replace(/^t-/, '')}` : 'быстрый чек'}</span>
                  <span className="font-medium">{formatTenge(orderTotal(o))}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMergeOpen(false)} className="w-full text-center px-4 h-11 mt-3 rounded-md bg-gray-200">Отмена</button>
          </div>
        </div>
      )}

      {qtyOpen && selLine && (
        <QuantityModal
          dishName={selLine.name}
          unit={findDish(selLine.dishId)?.isWeight ? 'кг' : 'ШТ'}
          value={selLine.qty}
          onOk={(n) => { pos.setLineQty(selLine.uid, n); setQtyOpen(false) }}
          onCancel={() => setQtyOpen(false)}
        />
      )}
      {modDish && <ModifiersModal dish={modDish} onConfirm={onModConfirm} onCancel={() => setModDish(null)} />}
      {showTransfer && <TransferModal orderId={order.id} onClose={() => setShowTransfer(false)} onMoved={() => { setShowTransfer(false); navigate('/halls') }} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} onPick={(d) => { setShowSearch(false); addDish(d) }} />}
      {showDiscount && (
        <DiscountModal
          subtotal={orderSubtotal(order)}
          discountPct={order.discountPct}
          surchargePct={order.surchargePct}
          discountAmount={order.discountAmount}
          selLineName={selLine?.name}
          selLineDiscount={selLine?.discountPct}
          onApplyDiscount={(pct) => pos.setDiscount(pct)}
          onApplySurcharge={(pct) => pos.setSurcharge(pct)}
          onApplyDiscountAmount={(a) => pos.setDiscountAmount(a)}
          onApplyLineDiscount={(pct) => selUid && pos.setLineDiscount(selUid, pct)}
          onClose={() => setShowDiscount(false)}
        />
      )}

      {/* перенести выбранную позицию другому гостю (ножницы) */}
      {moveGuest && selUid && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[360px]">
            <div className="text-lg font-semibold mb-3">Перенести позицию гостю</div>
            <div className="grid grid-cols-3 gap-2">
              {guestList.map((g) => (
                <button key={g} onClick={() => { pos.setGuestNo(selUid, g); setActiveGuest(g); setMoveGuest(false) }}
                  className={`h-12 rounded-md ${g === activeGuest ? 'bg-gray-200' : 'bg-pos-blue text-white'}`}>Гость {g}</button>
              ))}
            </div>
            <button onClick={() => setMoveGuest(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Отмена</button>
          </div>
        </div>
      )}

      {/* оплата по гостям */}
      {guestPay && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[420px]">
            <div className="text-lg font-semibold mb-3">Оплата по гостям</div>
            <div className="flex flex-col gap-2">
              {guestList.filter((g) => guestSum(g) > 0).map((g) => (
                <button key={g} onClick={() => navigate(`/payment?guest=${g}`)}
                  className="flex justify-between items-center h-12 px-4 rounded-md bg-pos-blue text-white">
                  <span>Гость {g}</span><span>{formatTenge(guestSum(g))}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setGuestPay(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Закрыть</button>
          </div>
        </div>
      )}

      {/* сменить официанта на заказе */}
      {waiterPick && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setWaiterPick(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-3">Официант заказа</div>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-auto">
              {pos.staffList.map((s) => (
                <button key={s.id} onClick={() => { pos.setOrderWaiter(order.id, s.name); setWaiterPick(false); printToast(`Официант заказа: ${s.name}`) }}
                  className={`h-12 rounded-md px-2 text-sm ${s.name === order.waiter ? 'bg-gray-200' : 'bg-pos-blue text-white'}`}>{s.name}</button>
              ))}
            </div>
            <button onClick={() => setWaiterPick(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Отмена</button>
          </div>
        </div>
      )}

      {/* переключение типа заказа (зал / вынос / доставка) */}
      {typePick && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setTypePick(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-3">Тип заказа</div>
            <div className="flex flex-col gap-2">
              {pos.orderTypes.map((t) => (
                <button key={t.id} onClick={() => { pos.setOrderType(order.id, t.mode); setTypePick(false); printToast(`Тип заказа: ${t.name}`) }}
                  className={`h-12 rounded-md flex items-center justify-between px-4 ${order.type === t.mode ? 'bg-gray-200 text-gray-800' : 'bg-pos-blue text-white'}`}>
                  <span>{t.name}</span><span className="text-xs opacity-70">ҚҚС {t.vat}%</span>
                </button>
              ))}
            </div>
            <button onClick={() => setTypePick(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Отмена</button>
          </div>
        </div>
      )}

      {/* ценовая категория заказа (прайс-лист по категории гостя/карты) */}
      {catPick && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setCatPick(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-1">Ценовая категория</div>
            <div className="text-sm text-gray-500 mb-3">Влияет на цену новых позиций заказа.</div>
            <div className="flex flex-col gap-2">
              {pos.priceCategories.map((c) => (
                <button key={c.id} onClick={() => { pos.setActivePriceCategory(c.id); setCatPick(false); printToast(`Ценовая категория: ${c.name}`) }}
                  className={`h-12 rounded-md ${pos.activePriceCategory === c.id ? 'bg-gray-200 text-gray-800' : 'bg-pos-blue text-white'}`}>{c.name}</button>
              ))}
            </div>
            <button onClick={() => setCatPick(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Отмена</button>
          </div>
        </div>
      )}

      {/* карта гостя iikoCard: прокатка/ввод номера → привязка к заказу */}
      {guestCard && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setGuestCard(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-1">Карта гостя (iikoCard)</div>
            <div className="text-sm text-gray-500 mb-3">Начисление {pos.loyaltyProgram.accrualPct}% от оплаты деньгами · оплата бонусами до {pos.loyaltyProgram.redeemLimitPct}% чека.</div>
            {loyaltyCard ? (
              <div className="bg-pink-50 border border-pink-200 rounded-md p-3 mb-3">
                <div className="font-medium">★ {loyaltyCard.owner}</div>
                <div className="text-sm text-gray-500">{loyaltyCard.number} · {loyaltyCard.phone}</div>
                <div className="text-sm mt-1">Баланс бонусов: <b>{formatTenge(loyaltyCard.balance)}</b></div>
                <button onClick={() => { pos.attachLoyaltyCard(order.id, undefined); setGuestCard(false) }} className="mt-2 h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">Отвязать карту</button>
              </div>
            ) : (
              <>
                <form onSubmit={(e) => { e.preventDefault(); const c = pos.loyaltyCards.find((x) => x.number.replace(/\s/g, '') === cardNum.replace(/\s/g, '') || x.phone.replace(/\D/g, '') === cardNum.replace(/\D/g, '')); if (c) { pos.attachLoyaltyCard(order.id, c.id); setGuestCard(false) } else printToast('Карта не найдена') }} className="flex gap-2 mb-3">
                  <input value={cardNum} onChange={(e) => setCardNum(e.target.value)} autoFocus placeholder="номер карты / телефон" className="flex-1 h-10 rounded-md border border-gray-300 px-3 outline-none" />
                  <button type="submit" disabled={!cardNum.trim()} className="h-10 px-4 rounded-md bg-pos-blue text-white disabled:opacity-40">Привязать</button>
                </form>
                <div className="text-xs text-gray-400 mb-1">Или выберите карту:</div>
                <div className="grid grid-cols-1 gap-1 max-h-44 overflow-auto">
                  {pos.loyaltyCards.map((c) => (
                    <button key={c.id} onClick={() => { pos.attachLoyaltyCard(order.id, c.id); setGuestCard(false) }}
                      className="flex items-center justify-between px-3 h-11 rounded-md bg-gray-100 hover:bg-gray-200 text-left">
                      <span>{c.owner} <span className="text-xs text-gray-400">{c.number}</span></span>
                      <span className="text-sm text-emerald-700">{formatTenge(c.balance)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => setGuestCard(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Закрыть</button>
          </div>
        </div>
      )}

      {/* курсы подачи: назначить курс выбранной позиции + подать курс на кухню */}
      {coursePick && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30" onClick={() => setCoursePick(false)}>
          <div className="bg-white text-gray-800 rounded-lg p-5 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-1">Курсы подачи</div>
            {selUid && selLine ? (
              <>
                <div className="text-sm text-gray-500 mb-3">Позиция: {selLine.name} {selLine.course ? `· сейчас курс ${selLine.course}` : '· курс не задан'}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3].map((c) => (
                    <button key={c} onClick={() => { pos.setLineCourse(selUid, c); setCoursePick(false) }}
                      className={`h-12 rounded-md ${selLine.course === c ? 'bg-gray-200' : 'bg-pos-blue text-white'}`}>Курс {c}</button>
                  ))}
                  <button onClick={() => { pos.setLineCourse(selUid, undefined); setCoursePick(false) }} className="h-12 rounded-md bg-gray-100">Без курса</button>
                </div>
              </>
            ) : <div className="text-sm text-gray-500 mb-3">Выберите позицию, чтобы назначить ей курс.</div>}
            {courseList.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-2">Подать курс на кухню:</div>
                <div className="flex flex-wrap gap-2">
                  {courseList.map((c) => (
                    <button key={c} onClick={() => { serveCourse(c); setCoursePick(false) }} className="h-11 px-4 rounded-md bg-pos-green text-white">Подать курс {c}</button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setCoursePick(false)} className="mt-4 h-11 w-full rounded-md bg-gray-200">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  )
}
