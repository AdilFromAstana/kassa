import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, Lock, ChevronLeft, Banknote, CreditCard, Ban, MoreHorizontal, Gift, UtensilsCrossed, ReceiptText, Send, X } from 'lucide-react'
import { usePos, lineTotal } from '../store/pos'
import { findTable } from '../mock/data'
import { formatTenge, vatBreakdown } from '../lib/money'
import { printToast } from '../lib/print'
import type { PaymentSplit, ClosedOrder, PaymentKind } from '../types'

// Экран оплаты заказа (ОПЛАТА ЗАКАЗА #N) — 1:1 с iikoFront:
// слева состав по гостю + итоги, в центре «К оплате» + плитки оплат + внесено/внести/сдача,
// справа вкладки типов оплат + дисплей + numpad с быстрыми кнопками + «Точная сумма».
// Вкладки строятся из АКТИВНЫХ типов оплат офиса (Розничные продажи → Типы оплат).
const QUICK = [[1, 5], [10, 50], [100, 500], [1000, 5000]]
const ICON_BY_KIND: Record<PaymentKind, typeof Banknote> = {
  cash: Banknote, card: CreditCard, cashless: Ban, noRevenue: MoreHorizontal, bonus: Gift,
}
const parseNum = (s: string) => parseFloat((s || '0').replace(',', '.')) || 0

export default function PaymentScreen() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const guestParam = sp.get('guest')
  const guestNo = guestParam ? parseInt(guestParam, 10) : null
  const pos = usePos()
  const order = pos.currentOrder()
  const [receipt, setReceipt] = useState<ClosedOrder | null>(null)
  const [send, setSend] = useState<'email' | 'sms' | null>(null) // отправка чека
  const [sendTo, setSendTo] = useState('')

  const paymentTypes = pos.paymentTypes
  const tabs = paymentTypes.filter((p) => p.active)
  const nameOf = (id: string) => paymentTypes.find((p) => p.id === id)?.name ?? ''
  const firstId = tabs[0]?.id ?? 'p-cash'

  const [lines, setLines] = useState<string[]>([firstId]) // типы оплат в работе
  const [active, setActive] = useState(firstId)
  const [entry, setEntry] = useState<Record<string, string>>({})

  if (!order && !receipt) { navigate('/halls'); return null }

  // ───────── чек закрыт: фискальный чек (мок Webkassa) ─────────
  if (receipt) {
    return (
      <div className="h-full flex flex-col bg-pos-bg text-white">
        <div className="h-12 bg-white flex items-center px-4 font-semibold text-gray-800 shrink-0">Чек закрыт</div>
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white text-gray-800 rounded-lg p-6 w-[360px] font-mono text-sm">
            <div className="text-center font-bold mb-2">ФИСКАЛЬНЫЙ ЧЕК (Webkassa)</div>
            <div className="text-center text-xs text-gray-500 mb-3">KZ БИН 123456789012 · ҚҚС 16%</div>
            {receipt.lines.map((l) => (
              <div key={l.uid} className="flex justify-between"><span>{l.name} ×{l.qty}</span><span>{formatTenge(lineTotal(l))}</span></div>
            ))}
            <div className="border-t border-dashed my-2" />
            <div className="flex justify-between font-bold"><span>ИТОГО</span><span>{formatTenge(receipt.total)}</span></div>
            {receipt.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-gray-600"><span>{p.name}</span><span>{formatTenge(p.amount)}</span></div>
            ))}
            <div className="flex justify-between"><span>Сдача</span><span>{formatTenge(receipt.change)}</span></div>
            {vatBreakdown(receipt.lines.map((l) => ({ gross: lineTotal(l), rate: l.vat }))).map((r) => (
              <div key={r.rate} className="flex justify-between text-gray-500"><span>в т.ч. ҚҚС {r.rate}%</span><span>{formatTenge(r.vat)}</span></div>
            ))}
            <div className="text-center text-xs text-gray-400 mt-3">ФД №{receipt.fiscalDocNo} · {receipt.paidAt}</div>
          </div>
        </div>
        <div className="h-16 bg-white flex items-center justify-center gap-3 flex-wrap">
          <button onClick={() => { setSend('email'); setSendTo('') }} className="h-12 px-5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100">Чек на e-mail</button>
          <button onClick={() => { setSend('sms'); setSendTo('') }} className="h-12 px-5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100">Чек по SMS</button>
          {pos.currentOrder() && <button onClick={() => navigate('/order')} className="h-12 px-6 rounded-md bg-pos-green text-white">К заказу (остались гости)</button>}
          <button onClick={() => navigate('/halls')} className="h-12 px-6 rounded-md bg-pos-blue text-white">К столам</button>
          <button onClick={() => navigate('/menu')} className="h-12 px-6 rounded-md bg-gray-200 text-gray-700">В меню</button>
        </div>

        {send && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSend(null)}>
            <div className="bg-white text-gray-800 rounded-lg w-[360px] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold mb-1">{send === 'email' ? 'Отправить чек на e-mail' : 'Отправить чек по SMS'}</div>
              <div className="text-xs text-gray-500 mb-3">ФД №{receipt.fiscalDocNo} · {formatTenge(receipt.total)} (Webkassa)</div>
              <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} autoFocus
                inputMode={send === 'email' ? 'email' : 'tel'}
                placeholder={send === 'email' ? 'guest@mail.kz' : '+7 7XX XXX XX XX'}
                className="w-full h-11 rounded-md border border-gray-300 px-3 outline-none" />
              <div className="flex gap-2 mt-4">
                <button disabled={!sendTo.trim()}
                  onClick={() => { printToast(`Чек ФД №${receipt.fiscalDocNo} отправлен ${send === 'email' ? 'на ' : 'по SMS: '}${sendTo.trim()}`); setSend(null) }}
                  className="flex-1 h-11 rounded-md bg-pos-blue text-white disabled:opacity-40">Отправить</button>
                <button onClick={() => setSend(null)} className="h-11 px-5 rounded-md bg-gray-200">Отмена</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ───────── расчёты ─────────
  const payLines = guestNo != null ? order!.lines.filter((l) => l.guestNo === guestNo) : order!.lines
  const sub = payLines.reduce((s, l) => s + lineTotal(l), 0)
  const total = +(sub * (1 - order!.discountPct / 100) * (1 + order!.surchargePct / 100)).toFixed(2)
  const amountOf = (id: string) => parseNum(entry[id])
  const paid = +lines.reduce((s, id) => s + amountOf(id), 0).toFixed(2)
  const toPayLeft = Math.max(0, +(total - paid).toFixed(2)) // «ВНЕСТИ»
  const change = Math.max(0, +(paid - total).toFixed(2))    // «СДАЧА»
  const fiscalSep = pos.establishment.fiscalBeforePay // 9.x: раздельная печать фискального чека перед оплатой
  const isFiscalized = order!.status === 'fiscalized'

  const selectTab = (id: string) => {
    setActive(id)
    setLines((ls) => (ls.includes(id) ? ls : [...ls, id]))
    // «Устанавливать точную сумму» (атрибут типа оплаты) — авто-внос остатка к оплате
    const pt = paymentTypes.find((p) => p.id === id)
    if (pt?.exactSum) setEntry((e) => ({ ...e, [id]: String(+(amountOf(id) + toPayLeft).toFixed(2)) }))
  }
  const setActiveEntry = (s: string) => setEntry((e) => ({ ...e, [active]: s }))
  const digit = (d: string) => setActiveEntry((entry[active] === '0' || !entry[active] ? '' : entry[active]) + d)
  const comma = () => setActiveEntry(entry[active]?.includes(',') ? entry[active] : (entry[active] || '0') + ',')
  const backspace = () => setActiveEntry((entry[active] || '').slice(0, -1))
  const quick = (n: number) => setActiveEntry(String(amountOf(active) + n))
  const exact = () => setActiveEntry(String(+(amountOf(active) + toPayLeft).toFixed(2))) // дозаполнить до полной суммы
  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((x) => x !== id))
    setEntry((e) => { const c = { ...e }; delete c[id]; return c })
    if (active === id) setActive(firstId)
  }

  const splitsNow = (): PaymentSplit[] => lines
    .filter((id) => amountOf(id) > 0)
    .map((id) => ({ paymentTypeId: id, name: nameOf(id), amount: amountOf(id) }))

  const doPay = () => {
    const splits = splitsNow()
    if (splits.length === 0) return
    const used = paymentTypes.filter((p) => splits.some((s) => s.paymentTypeId === p.id))
    const closed = guestNo != null ? pos.payByGuest(guestNo, splits, paid) : pos.pay(splits, paid)
    if (closed) {
      if (used.some((p) => p.openDrawer)) printToast('Денежный ящик открыт')
      if (used.some((p) => p.printReceipt)) printToast('Печать товарного чека')
      setReceipt(closed)
    }
  }

  // 9.x: печать фискального чека ДО оплаты — стол не закрывается, заказ переходит в стадию оплаты
  const doFiscal = () => {
    const splits = splitsNow()
    if (splits.length === 0) return
    printToast(`Фискальный чек (Webkassa) на ${formatTenge(total)} · ${splits.map((s) => s.name).join(', ')}\nСтол не закрыт — примите оплату`)
    pos.fiscalizeOrder()
  }

  const tableLabel = order!.tableId ? `Стол #${findTable(order!.tableId)?.no ?? order!.tableId.replace(/^t-/, '')}` : 'Быстрый чек'

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      {/* статус-строка */}
      <div className="h-6 bg-[#1f1f1f] text-white/40 text-[11px] flex items-center justify-between px-3 shrink-0">
        <span>iiko POS v0.1 (мок)</span>
        <span>{pos.cashShift ? `Смена открыта · ${pos.user?.name ?? ''}` : ''}</span>
      </div>
      {/* шапка заказа */}
      <div className="bg-white text-gray-900 px-5 py-2 flex items-center shrink-0">
        <div>
          <div className="text-xl font-bold">ОПЛАТА ЗАКАЗА #{order!.id}</div>
          <div className="text-xs text-gray-500 flex gap-6 mt-0.5">
            <span>Открыт: {order!.openedAt}</span>
            <span>Официант: {order!.waiter}</span>
            <span>{tableLabel}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-5 text-gray-700">
          <button onClick={() => navigate('/menu')} title="Доп. меню"><Menu size={26} /></button>
          <button onClick={() => { pos.logout(); navigate('/') }} title="Заблокировать"><Lock size={22} /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ЛЕВО: состав по гостю + итоги */}
        <div className="w-[34%] bg-pos-panel text-gray-800 flex flex-col border-r border-black/30">
          <div className="bg-gray-300 text-gray-700 text-center py-1.5 font-medium">{guestNo != null ? `ГОСТЬ ${guestNo}` : order!.guests <= 1 ? 'ГОСТЬ 1' : 'ВЕСЬ ЗАКАЗ'}</div>
          <div className="flex-1 overflow-auto">
            {payLines.map((l, i) => (
              <div key={l.uid} className="flex justify-between px-4 py-2 border-b border-gray-200">
                <span><span className="text-gray-400 mr-3">{i + 1}</span>{l.name}{l.qty !== 1 && <span className="text-gray-500"> ×{String(l.qty).replace('.', ',')}</span>}</span>
                <span>{formatTenge(lineTotal(l))}</span>
              </div>
            ))}
          </div>
          <div className="bg-[#3a3f42] text-white/90 text-sm">
            <Tot k="ПОДЫТОГ" v={formatTenge(sub)} />
            <Tot k="СКИДКА" v={`${order!.discountPct.toFixed(2)}%`} />
            <Tot k="НАДБАВКА" v={`${order!.surchargePct.toFixed(2)}%`} />
            <Tot k="ПРЕДОПЛАТА" v={formatTenge(0)} />
            <div className="flex justify-between px-4 py-2 text-2xl font-bold border-t border-black/30"><span>ИТОГО:</span><span>{formatTenge(total)}</span></div>
          </div>
        </div>

        {/* ЦЕНТР: к оплате + плитки оплат + внесено/внести/сдача */}
        <div className="w-[24%] bg-[#4a4f52] flex flex-col">
          <div className="flex justify-between items-baseline px-4 py-3">
            <span className="text-white/70">К ОПЛАТЕ:</span>
            <span className="text-2xl font-bold">{formatTenge(total)}</span>
          </div>
          {fiscalSep && isFiscalized && <div className="mx-4 mb-2 text-pos-accent text-sm">✓ Фискальный чек напечатан — примите оплату</div>}
          <div className="flex-1 overflow-auto">
            {lines.map((id) => (
              <button key={id} onClick={() => setActive(id)}
                className={`w-full text-left px-4 py-3 border-b border-black/20 ${active === id ? 'bg-pos-accent text-gray-900' : 'bg-black/10 text-white/80'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{nameOf(id)}</span>
                  <span onClick={(e) => { e.stopPropagation(); removeLine(id) }} className="p-1 -m-1"><X size={18} /></span>
                </div>
                <div className="text-right text-xl">{formatTenge(amountOf(id))}</div>
              </button>
            ))}
          </div>
          <div className="text-sm">
            <Tot k="ВНЕСЕНО:" v={formatTenge(paid)} />
            <Tot k="ВНЕСТИ:" v={formatTenge(toPayLeft)} />
            <Tot k="СДАЧА:" v={formatTenge(change)} />
          </div>
        </div>

        {/* ПРАВО: вкладки типов + дисплей + numpad + быстрые суммы */}
        <div className="flex-1 flex flex-col bg-pos-bg">
          <div className="grid shrink-0" style={{ gridTemplateColumns: `repeat(${Math.max(1, tabs.length)}, minmax(0,1fr))` }}>
            {tabs.map((pt) => {
              const Icon = ICON_BY_KIND[pt.kind] ?? MoreHorizontal
              return (
                <button key={pt.id} onClick={() => selectTab(pt.id)}
                  className={`h-20 flex flex-col items-center justify-center gap-1 border-r border-black/20 ${active === pt.id ? 'bg-pos-accent text-gray-900' : 'bg-[#6d7479] text-white'}`}>
                  <Icon size={24} /><span className="text-xs leading-tight text-center px-1 uppercase">{pt.name}</span>
                </button>
              )
            })}
          </div>
          <div className="text-center text-pos-accent text-lg pt-3">{nameOf(active).toUpperCase()}</div>
          <div className="text-center text-5xl font-light py-4">{formatTenge(amountOf(active))}</div>

          <div className="flex-1 grid grid-cols-5 gap-px bg-black/30 px-px">
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, r) => (
              <Frag key={r}>
                {row.map((d) => <Key key={d} onClick={() => digit(d)}>{d}</Key>)}
                <Key dark onClick={() => quick(QUICK[r][0])}>+{QUICK[r][0]}</Key>
                <Key dark onClick={() => quick(QUICK[r][1])}>+{QUICK[r][1]}</Key>
              </Frag>
            ))}
            <Key onClick={comma}>,</Key>
            <Key onClick={() => digit('0')}>0</Key>
            <Key onClick={backspace}><X size={28} /></Key>
            <Key dark onClick={() => quick(QUICK[3][0])}>+{QUICK[3][0]}</Key>
            <Key dark onClick={() => quick(QUICK[3][1])}>+{QUICK[3][1]}</Key>
          </div>
          <button onClick={exact} className="h-14 bg-white text-gray-800 text-lg active:bg-gray-100 border-t border-black/20 shrink-0">ТОЧНАЯ СУММА</button>
        </div>
      </div>

      {/* нижняя панель */}
      <div className="h-16 bg-[#111] text-white flex items-center px-5 gap-8 shrink-0">
        <BarBtn onClick={() => navigate('/order')} Icon={ChevronLeft} label="НАЗАД" />
        <BarBtn onClick={() => navigate('/order')} Icon={UtensilsCrossed} label="ЗАКАЗ" />
        <BarBtn onClick={() => printToast('Товарный чек')} Icon={ReceiptText} label="С ТОВАРНЫМ ЧЕКОМ" />
        <BarBtn onClick={() => printToast('Чек отправлен')} Icon={Send} label="ОТПРАВКА ЧЕКА" />
        {!fiscalSep ? (
          <button onClick={doPay} disabled={paid < total || total <= 0}
            className={`ml-auto h-12 px-12 rounded-md text-2xl font-light ${paid >= total && total > 0 ? 'text-white active:bg-white/10' : 'text-white/30'}`}>
            ОПЛАТИТЬ
          </button>
        ) : !isFiscalized ? (
          <button onClick={doFiscal} disabled={paid < total || total <= 0}
            className={`ml-auto h-12 px-10 rounded-md text-xl font-light ${paid >= total && total > 0 ? 'bg-pos-accent text-gray-900' : 'text-white/30'}`}>
            ФИСКАЛЬНЫЙ ЧЕК
          </button>
        ) : (
          <button onClick={doPay} className="ml-auto h-12 px-10 rounded-md text-xl font-light bg-pos-green text-white active:opacity-90">
            ЗАКРЫТЬ ЗАКАЗ
          </button>
        )}
      </div>
    </div>
  )
}

const Frag = ({ children }: { children: React.ReactNode }) => <>{children}</>
const Tot = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between px-4 py-1.5"><span className="text-white/60">{k}</span><span>{v}</span></div>
)
const Key = ({ children, onClick, dark }: { children: React.ReactNode; onClick: () => void; dark?: boolean }) => (
  <button onClick={onClick}
    className={`flex items-center justify-center text-3xl font-light active:bg-pos-accent ${dark ? 'bg-[#2f3a2f] text-white text-2xl' : 'bg-white text-gray-800'}`}>
    {children}
  </button>
)
const BarBtn = ({ onClick, Icon, label }: { onClick: () => void; Icon: typeof ChevronLeft; label: string }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-0.5 text-[11px] text-white/80 active:text-white">
    <Icon size={22} /><span>{label}</span>
  </button>
)
