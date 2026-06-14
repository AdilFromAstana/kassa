import { useState } from 'react'
import { Trash2, Plus, AlertTriangle, Phone } from 'lucide-react'
import { usePos } from '../store/pos'
import { dishes } from '../mock/menu'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import type { DeliveryStatus, DeliveryItem } from '../types'

// Доставка (модуль 14, iikoDelivery) — заказы с жизненным циклом + клиенты, курьеры, справочники, отчёт.
type Tab = 'orders' | 'customers' | 'couriers' | 'refs' | 'reports'

const STATUS: Record<DeliveryStatus, { label: string; cls: string }> = {
  new: { label: 'Принят', cls: 'bg-slate-100 text-slate-700' },
  confirmed: { label: 'Подтверждён', cls: 'bg-blue-100 text-blue-700' },
  cooking: { label: 'Готовится', cls: 'bg-amber-100 text-amber-700' },
  onway: { label: 'В пути', cls: 'bg-violet-100 text-violet-700' },
  delivered: { label: 'Доставлен', cls: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Закрыт', cls: 'bg-gray-200 text-gray-600' },
  cancelled: { label: 'Отменён', cls: 'bg-rose-100 text-rose-700' },
}

export default function OfficeDelivery() {
  const pos = usePos()
  const [tab, setTab] = useState<Tab>('orders')
  const [assignFor, setAssignFor] = useState<number | null>(null) // заказ, для которого назначаем курьера

  // конструктор нового заказа
  const [draft, setDraft] = useState({ type: 'courier' as 'courier' | 'pickup', customerId: '', name: '', phone: '', address: '', adSource: 'Сайт' })
  const [items, setItems] = useState<DeliveryItem[]>([])
  const [pickDish, setPickDish] = useState(dishes[0]?.id ?? '')
  const [pickQty, setPickQty] = useState('1')
  const [creating, setCreating] = useState(false)

  // новые клиент / курьер / справочники
  const [newCust, setNewCust] = useState({ name: '', phone: '', street: '', house: '', apt: '', district: '', adSource: 'Сайт', comment: '' })
  const [newCourier, setNewCourier] = useState('')
  const [newRef, setNewRef] = useState({ city: '', street: '', district: '' })

  const s = pos.deliverySettings
  const courierName = (id?: string) => pos.couriers.find((c) => c.id === id)?.name ?? '—'
  // право D_* учитывается, если на терминале есть авторизованный сотрудник (в чистом офисе без входа — не ограничиваем)
  const allow = (code: string) => !pos.user || pos.can(code)
  const maskPhone = (p: string) => (!pos.user || pos.can('D_SFN')) ? p : p.replace(/(\d{2})\d{3}(\d{2})/, '$1•••$2')

  const addItem = () => {
    const d = dishes.find((x) => x.id === pickDish); const q = parseInt(pickQty, 10) || 0
    if (!d || q <= 0) return
    setItems((ls) => [...ls.filter((l) => l.name !== d.name), { name: d.name, qty: q, price: pos.priceOf(d.id, d.price) }])
  }
  const draftGoods = items.reduce((sum, it) => sum + it.qty * it.price, 0)
  const submitOrder = () => {
    if (items.length === 0) return
    const cust = pos.deliveryCustomers.find((c) => c.id === draft.customerId)
    const name = cust?.name || draft.name.trim()
    const phone = cust?.phone || draft.phone.trim()
    const address = draft.type === 'pickup' ? 'Самовывоз' : (cust ? `${cust.street} ${cust.house}, кв. ${cust.apt} · ${cust.district}` : draft.address.trim())
    if (!name || (draft.type === 'courier' && !address)) { printToast('Укажите клиента и адрес'); return }
    const o = pos.createDeliveryOrder({ type: draft.type, customerName: name, phone, address, adSource: draft.adSource, items })
    printToast(`Доставка ${o.no} создана`)
    setItems([]); setDraft({ type: 'courier', customerId: '', name: '', phone: '', address: '', adSource: 'Сайт' }); setCreating(false)
  }

  // действия жизненного цикла (0)…(5)
  const advance = (id: number, to: DeliveryStatus) => pos.setDeliveryStatus(id, to)
  const onSend = (o: { id: number; type: 'courier' | 'pickup' }) => { if (o.type === 'pickup') advance(o.id, 'delivered'); else setAssignFor(o.id) }
  const doCancel = (id: number) => { const r = window.prompt('Причина отмены доставки:', 'Отказ клиента'); if (r != null) pos.cancelDelivery(id, r || 'Без причины') }

  const Stepper = ({ o }: { o: { id: number; status: DeliveryStatus; type: 'courier' | 'pickup' } }) => {
    if (o.status === 'cancelled' || o.status === 'closed') return null
    const btn = (label: string, fn: () => void, ok: boolean, cls = 'bg-blue-600') =>
      <button onClick={fn} disabled={!ok} className={`h-7 px-2 rounded text-xs text-white disabled:opacity-30 ${cls}`}>{label}</button>
    return (
      <div className="flex gap-1 justify-end flex-wrap">
        {o.status === 'new' && btn('(1) Подтв.', () => advance(o.id, 'confirmed'), allow('D_CND'))}
        {o.status === 'confirmed' && btn('(2) Готовить', () => advance(o.id, 'cooking'), allow('D_MD'), 'bg-amber-500')}
        {o.status === 'cooking' && btn('(3) Отправить', () => onSend(o), allow('D_AC'), 'bg-violet-600')}
        {o.status === 'onway' && btn('(4) Доставл.', () => advance(o.id, 'delivered'), allow('D_MD'), 'bg-emerald-600')}
        {o.status === 'delivered' && btn('(5) Закрыть', () => advance(o.id, 'closed'), allow('D_CD'), 'bg-gray-600')}
        {btn('(0) Отмена', () => doCancel(o.id), allow('D_CAD'), 'bg-rose-500')}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="text-xs text-gray-500 mb-4">
        Доставка (iikoDelivery, модуль 14). Жизненный цикл заказа: Принят → Подтверждён → Готовится → В пути → Доставлен → Закрыт.
        Курьеру назначается только заказ в статусе «Готовится» (кнопка «Отправить»); курьер должен быть на смене.
      </div>
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([['orders', 'Заказы'], ['customers', 'Клиенты'], ['couriers', 'Курьеры'], ['refs', 'Справочники / настройки'], ['reports', 'Отчёты']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 h-10 text-sm -mb-px border-b-2 ${tab === id ? 'border-emerald-500 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          <div className="flex items-center mb-3">
            <div className="text-gray-500 text-xs uppercase">Заказы доставки ({pos.deliveryOrders.length})</div>
            <button onClick={() => setCreating((v) => !v)} className="ml-auto h-9 px-4 rounded bg-emerald-500 text-white text-sm inline-flex items-center gap-1"><Plus size={14} />Новый заказ</button>
          </div>

          {creating && (
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'courier' | 'pickup' })} className="h-9 rounded border border-gray-300 px-2 text-sm">
                  <option value="courier">Курьером</option><option value="pickup">Самовывоз</option>
                </select>
                <select value={draft.customerId} onChange={(e) => setDraft({ ...draft, customerId: e.target.value })} className="h-9 rounded border border-gray-300 px-2 text-sm min-w-[180px]">
                  <option value="">— клиент (или вручную) —</option>
                  {pos.deliveryCustomers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
                </select>
                {!draft.customerId && <>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Имя" className="h-9 rounded border border-gray-300 px-2 text-sm w-32" />
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Телефон" className="h-9 rounded border border-gray-300 px-2 text-sm w-40" />
                  {draft.type === 'courier' && <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Адрес" className="h-9 rounded border border-gray-300 px-2 text-sm flex-1 min-w-[160px]" />}
                </>}
                <select value={draft.adSource} onChange={(e) => setDraft({ ...draft, adSource: e.target.value })} className="h-9 rounded border border-gray-300 px-2 text-sm">
                  {['Сайт', 'Instagram', 'Листовка', 'Агрегатор', 'Радио'].map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <select value={pickDish} onChange={(e) => setPickDish(e.target.value)} className="h-9 rounded border border-gray-300 px-2 text-sm min-w-[200px]">
                  {dishes.map((d) => <option key={d.id} value={d.id}>{d.name} · {formatTenge(pos.priceOf(d.id, d.price))}</option>)}
                </select>
                <input value={pickQty} onChange={(e) => setPickQty(e.target.value.replace(/\D/g, ''))} className="h-9 w-16 rounded border border-gray-300 px-2 text-right text-sm" />
                <button onClick={addItem} className="h-9 px-3 rounded bg-gray-200 text-gray-700 text-sm">+ блюдо</button>
                {items.length > 0 && <span className="text-sm text-gray-500 ml-2">Блюда: {formatTenge(draftGoods)}{draft.type === 'courier' ? ` + доставка ${formatTenge(s.feeAmount)}` : ''}{draftGoods < s.minSum ? <span className="text-rose-600"> · ниже мин. суммы {formatTenge(s.minSum)}</span> : null}</span>}
              </div>
              {items.length > 0 && (
                <div className="border border-gray-100 rounded mb-2">
                  {items.map((it) => (
                    <div key={it.name} className="flex items-center gap-2 px-3 py-1 text-sm border-b border-gray-100 last:border-0">
                      <span className="flex-1">{it.name} ×{it.qty}</span><span>{formatTenge(it.qty * it.price)}</span>
                      <button onClick={() => setItems((ls) => ls.filter((x) => x.name !== it.name))} className="text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={submitOrder} disabled={items.length === 0} className={`h-9 px-5 rounded text-sm ${items.length ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Создать доставку</button>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">№</th><th>Статус</th><th>Клиент</th><th>Адрес</th><th>Курьер</th><th className="text-right">Сумма</th><th className="p-2 text-right">Действия</th></tr></thead>
              <tbody>
                {pos.deliveryOrders.map((o) => (
                  <tr key={o.id} className={`border-b border-gray-100 last:border-0 ${o.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <td className="p-2 font-medium">{o.no}<div className="text-xs text-gray-400">{o.type === 'pickup' ? 'самовывоз' : 'курьер'}</div></td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>{o.cancelReason ? <div className="text-xs text-rose-500">{o.cancelReason}</div> : null}</td>
                    <td>{o.customerName}<div className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{maskPhone(o.phone)}</div></td>
                    <td className="text-gray-600 text-xs max-w-[180px]">{o.address}</td>
                    <td className="text-gray-600 text-xs">{o.courierId ? courierName(o.courierId) : '—'}</td>
                    <td className="text-right">{formatTenge(o.goods + o.fee)}{o.fee > 0 && <div className="text-xs text-gray-400">+дост. {formatTenge(o.fee)}</div>}</td>
                    <td className="p-2"><Stepper o={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'customers' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Клиент</th><th>Телефон</th><th>Адрес</th><th>Реклама</th><th className="text-center">Высокий риск</th><th className="p-2"></th></tr></thead>
              <tbody>
                {pos.deliveryCustomers.map((c) => (
                  <tr key={c.id} className={`border-b border-gray-100 last:border-0 ${c.highRisk ? 'bg-rose-50' : ''}`}>
                    <td className="p-2">{c.name}</td>
                    <td className="text-gray-500">{maskPhone(c.phone)}</td>
                    <td className="text-gray-500 text-xs">{c.street} {c.house}, кв.{c.apt} · {c.district}</td>
                    <td className="text-gray-500 text-xs">{c.adSource}</td>
                    <td className="text-center">
                      <button onClick={() => pos.toggleHighRisk(c.id)} disabled={!allow('D_AHR')} title={allow('D_AHR') ? '' : 'Нужно право D_AHR'} className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 disabled:opacity-50 ${c.highRisk ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.highRisk && <AlertTriangle size={11} />}{c.highRisk ? 'да' : 'нет'}
                      </button>
                    </td>
                    <td className="p-2 text-right"><button onClick={() => pos.removeDeliveryCustomer(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2 bg-white border border-gray-200 rounded p-3">
            <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Имя*" className="h-9 rounded border border-gray-300 px-2 text-sm w-36" />
            <input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="Телефон*" className="h-9 rounded border border-gray-300 px-2 text-sm w-40" />
            <select value={newCust.street} onChange={(e) => setNewCust({ ...newCust, street: e.target.value })} className="h-9 rounded border border-gray-300 px-2 text-sm">
              <option value="">улица</option>{s.streets.map((st) => <option key={st}>{st}</option>)}
            </select>
            <input value={newCust.house} onChange={(e) => setNewCust({ ...newCust, house: e.target.value })} placeholder="дом" className="h-9 w-16 rounded border border-gray-300 px-2 text-sm" />
            <input value={newCust.apt} onChange={(e) => setNewCust({ ...newCust, apt: e.target.value })} placeholder="кв." className="h-9 w-16 rounded border border-gray-300 px-2 text-sm" />
            <select value={newCust.district} onChange={(e) => setNewCust({ ...newCust, district: e.target.value })} className="h-9 rounded border border-gray-300 px-2 text-sm">
              <option value="">район</option>{s.districts.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button onClick={() => { if (newCust.name.trim() && newCust.phone.trim()) { pos.addDeliveryCustomer({ ...newCust, highRisk: false }); setNewCust({ name: '', phone: '', street: '', house: '', apt: '', district: '', adSource: 'Сайт', comment: '' }) } }}
              className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить клиента</button>
          </div>
        </>
      )}

      {tab === 'couriers' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3 max-w-lg">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Курьер</th><th className="text-center">На смене</th><th className="text-right">Активных заказов</th><th className="p-2"></th></tr></thead>
              <tbody>
                {pos.couriers.map((c) => {
                  const active = pos.deliveryOrders.filter((o) => o.courierId === c.id && o.status === 'onway').length
                  return (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2">{c.name}</td>
                      <td className="text-center"><button onClick={() => pos.toggleCourierShift(c.id)} className={`text-xs px-2 py-0.5 rounded-full ${c.onShift ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{c.onShift ? 'на смене' : 'не на смене'}</button></td>
                      <td className="text-right text-gray-500">{active}</td>
                      <td className="p-2 text-right"><button onClick={() => pos.removeCourier(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-end gap-2">
            <input value={newCourier} onChange={(e) => setNewCourier(e.target.value)} placeholder="Имя курьера" className="h-9 rounded border border-gray-300 px-2 text-sm w-56" />
            <button onClick={() => { if (newCourier.trim()) { pos.addCourier(newCourier.trim()); setNewCourier('') } }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить курьера</button>
          </div>
        </>
      )}

      {tab === 'refs' && (
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-gray-500 text-xs uppercase mb-2">Настройки доставки</div>
            <label className="flex justify-between items-center text-sm py-1">Продолжительность, мин
              <input type="number" min={0} value={s.durationMin} onChange={(e) => pos.setDeliverySettings({ durationMin: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="w-24 h-8 rounded border border-gray-300 px-2 text-right" /></label>
            <label className="flex justify-between items-center text-sm py-1">Мин. сумма, ₸
              <input type="number" min={0} value={s.minSum} onChange={(e) => pos.setDeliverySettings({ minSum: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="w-28 h-8 rounded border border-gray-300 px-2 text-right" /></label>
            <label className="flex justify-between items-center text-sm py-1">Стоимость доставки, ₸
              <input type="number" min={0} value={s.feeAmount} onChange={(e) => pos.setDeliverySettings({ feeAmount: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="w-28 h-8 rounded border border-gray-300 px-2 text-right" /></label>
          </div>
          <RefList title="Города" items={s.cities} onAdd={(v) => pos.setDeliverySettings({ cities: [...s.cities, v] })} onDel={(v) => pos.setDeliverySettings({ cities: s.cities.filter((x) => x !== v) })} value={newRef.city} setValue={(v) => setNewRef({ ...newRef, city: v })} />
          <RefList title="Улицы" items={s.streets} onAdd={(v) => pos.setDeliverySettings({ streets: [...s.streets, v] })} onDel={(v) => pos.setDeliverySettings({ streets: s.streets.filter((x) => x !== v) })} value={newRef.street} setValue={(v) => setNewRef({ ...newRef, street: v })} />
          <RefList title="Районы доставки" items={s.districts} onAdd={(v) => pos.setDeliverySettings({ districts: [...s.districts, v] })} onDel={(v) => pos.setDeliverySettings({ districts: s.districts.filter((x) => x !== v) })} value={newRef.district} setValue={(v) => setNewRef({ ...newRef, district: v })} />
        </div>
      )}

      {tab === 'reports' && (() => {
        const done = pos.deliveryOrders.filter((o) => o.status === 'delivered' || o.status === 'closed')
        const active = pos.deliveryOrders.filter((o) => !['closed', 'cancelled'].includes(o.status))
        const cancelled = pos.deliveryOrders.filter((o) => o.status === 'cancelled')
        const revenue = done.reduce((sum, o) => sum + o.goods + o.fee, 0)
        const byCourier: Record<string, { n: number; sum: number }> = {}
        done.forEach((o) => { if (!o.courierId) return; const k = courierName(o.courierId); const c = (byCourier[k] ??= { n: 0, sum: 0 }); c.n++; c.sum += o.goods + o.fee })
        const byHour: Record<string, number> = {}
        pos.deliveryOrders.forEach((o) => { const h = (o.createdAt.split(' ')[1] ?? o.createdAt.split(',')[1]?.trim() ?? '').slice(0, 2) || '—'; byHour[h] = (byHour[h] ?? 0) + 1 })
        const byReason: Record<string, number> = {}
        cancelled.forEach((o) => { byReason[o.cancelReason || 'Без причины'] = (byReason[o.cancelReason || 'Без причины'] ?? 0) + 1 })
        return (
          <div className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-4 gap-3">
              <Stat k="В работе" v={String(active.length)} />
              <Stat k="Доставлено/закрыто" v={String(done.length)} />
              <Stat k="Отменено" v={String(cancelled.length)} />
              <Stat k="Выручка доставки" v={formatTenge(revenue)} />
            </div>
            <RepTable title="Доставки по курьерам" head={['Курьер', 'Заказов', 'Сумма']} rows={Object.entries(byCourier).map(([k, v]) => [k, String(v.n), formatTenge(v.sum)])} />
            <RepTable title="Доставки по часам" head={['Час', 'Заказов']} rows={Object.entries(byHour).sort().map(([k, v]) => [`${k}:00`, String(v)])} />
            <RepTable title="Причины отмен" head={['Причина', 'Кол-во']} rows={Object.entries(byReason).map(([k, v]) => [k, String(v)])} />
          </div>
        )
      })()}

      {/* назначение курьера (статус «Готовится» → выбрать курьера на смене → «В пути») */}
      {assignFor != null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAssignFor(null)}>
          <div className="bg-white rounded-lg w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-1">Назначить курьера</div>
            <div className="text-sm text-gray-500 mb-3">Доступны только курьеры на смене.</div>
            <div className="flex flex-col gap-2">
              {pos.couriers.filter((c) => c.onShift).map((c) => (
                <button key={c.id} onClick={() => { pos.assignCourier(assignFor, c.id); printToast(`Курьер ${c.name} назначен`); setAssignFor(null) }}
                  className="h-11 rounded-md bg-pos-blue text-white">{c.name}</button>
              ))}
              {pos.couriers.filter((c) => c.onShift).length === 0 && <div className="text-rose-600 text-sm">Нет курьеров на смене.</div>}
            </div>
            <button onClick={() => setAssignFor(null)} className="mt-4 h-10 w-full rounded-md bg-gray-200">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RefList({ title, items, onAdd, onDel, value, setValue }: { title: string; items: string[]; onAdd: (v: string) => void; onDel: (v: string) => void; value: string; setValue: (v: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="text-gray-500 text-xs uppercase mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1 h-7 px-2 rounded bg-gray-100 text-sm">{it}<button onClick={() => onDel(it)} className="text-gray-400 hover:text-red-500">✕</button></span>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="добавить" className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm" />
        <button onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue('') } }} className="h-8 px-3 rounded bg-gray-200 text-gray-700 text-sm">+</button>
      </div>
    </div>
  )
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="bg-white border border-gray-200 rounded-md p-3"><div className="text-xs text-gray-400">{k}</div><div className="text-lg font-bold text-gray-800">{v}</div></div>
)
const RepTable = ({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) => (
  <div>
    <div className="text-gray-500 text-xs uppercase mb-1">{title}</div>
    <div className="bg-white border border-gray-200 rounded-md overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-gray-500 text-left border-b border-gray-200">{head.map((h, i) => <th key={h} className={`p-2 ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={head.length} className="p-3 text-gray-400">Нет данных.</td></tr>
            : rows.map((r, i) => <tr key={i} className="border-b border-gray-100 last:border-0">{r.map((c, j) => <td key={j} className={`p-2 ${j > 0 ? 'text-right' : ''}`}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  </div>
)
