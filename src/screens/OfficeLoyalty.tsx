import { useState } from 'react'
import { Trash2, Plus, Wallet, Gift, Ticket, Settings2 } from 'lucide-react'
import { usePos } from '../store/pos'
import { menuGroups } from '../mock/menu'
import { formatTenge } from '../lib/money'
import { todayISO, addDaysISO, formatRu } from '../lib/date'
import { welcomeBonusOf, redeemLimitPctOf } from '../lib/loyalty'
import Tabs from '../components/Tabs'
import type { PromoActionType } from '../types'

// iikoCard (модуль 15) — программы лояльности: бонусная (конструктор акций), депозитная (кошелёк),
// сертификатная (подарочные сертификаты) + карты гостей. Правила начисления/списания задаются акциями
// «условие → действие». См. iiko_spec/15_iikocard.md.
type Tab = 'promo' | 'deposit' | 'certs' | 'cards'

const ACTION_TYPE_LABEL: Record<PromoActionType, string> = {
  accruePercent: 'Пополнить счёт на % от заказа',
  accrueFixed: 'Пополнить счёт на сумму',
  paymentLimit: 'Оплата со счёта (лимит %)',
  welcome: 'Приветственный бонус',
}
const STATUS_LABEL = { active: 'Действует', used: 'Погашен', expired: 'Просрочен' }

export default function OfficeLoyalty() {
  const pos = usePos()
  const [tab, setTab] = useState<Tab>('promo')

  // ── формы ──
  const [newAction, setNewAction] = useState<{ name: string; type: PromoActionType; percent: string; amount: string; minSum: string; groupId: string }>(
    { name: '', type: 'accruePercent', percent: '', amount: '', minSum: '', groupId: '' })
  const [newCard, setNewCard] = useState({ number: '', owner: '', phone: '' })
  const [topUp, setTopUp] = useState({ cardId: '', amount: '' })
  const [newCert, setNewCert] = useState({ number: '', nominal: '', owner: '', days: '180' })

  const num = (s: string) => Math.max(0, parseFloat((s || '').replace(',', '.')) || 0)

  const addAction = () => {
    const name = newAction.name.trim() || ACTION_TYPE_LABEL[newAction.type]
    pos.addPromoAction({
      name, type: newAction.type, active: true,
      percent: (newAction.type === 'accruePercent' || newAction.type === 'paymentLimit') ? num(newAction.percent) : undefined,
      amount: (newAction.type === 'accrueFixed' || newAction.type === 'welcome') ? num(newAction.amount) : undefined,
      minSum: newAction.minSum ? num(newAction.minSum) : undefined,
      groupId: (newAction.type === 'accruePercent' && newAction.groupId) ? newAction.groupId : undefined,
    })
    setNewAction({ name: '', type: 'accruePercent', percent: '', amount: '', minSum: '', groupId: '' })
  }
  const issueCard = () => {
    if (!newCard.number.trim() || !newCard.owner.trim()) return
    pos.addLoyaltyCard({ number: newCard.number.trim(), owner: newCard.owner.trim(), phone: newCard.phone.trim() })
    setNewCard({ number: '', owner: '', phone: '' })
  }
  const doTopUp = () => { const a = num(topUp.amount); if (topUp.cardId && a > 0) { pos.topUpDeposit(topUp.cardId, a); setTopUp({ cardId: '', amount: '' }) } }
  const issueCert = () => {
    const nominal = num(newCert.nominal); if (!newCert.number.trim() || !(nominal > 0)) return
    pos.issueCertificate({ number: newCert.number.trim(), nominal, owner: newCert.owner.trim() || undefined, expiresAt: addDaysISO(todayISO(), Math.round(num(newCert.days)) || 180) })
    setNewCert({ number: '', nominal: '', owner: '', days: '180' })
  }

  const TABS: [Tab, string, typeof Gift][] = [
    ['promo', 'Бонусы (акции)', Gift], ['deposit', 'Депозит (кошелёк)', Wallet], ['certs', 'Сертификаты', Ticket], ['cards', 'Карты гостей', Settings2],
  ]
  const inp = 'h-9 rounded border border-gray-300 px-2 text-sm'

  return (
    <div className="p-6 max-w-5xl">
      <div className="text-xs text-gray-500 mb-4">
        iikoCard (модуль 15) — программы лояльности. Правила задаются в <b>конструкторе акций</b> «условие → действие».
        Порядок применения на кассе: скидки → оплата бонусами → списание со счёта (депозит/сертификат).
      </div>

      {/* мастер-переключатель бонусной программы */}
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={pos.loyaltyProgram.active} onChange={(e) => pos.setLoyaltyProgram({ active: e.target.checked })} />
        Бонусная программа iikoCard активна (карта гостя на кассе)
      </label>

      {/* вкладки */}
      <Tabs active={tab} onChange={setTab} items={TABS.map(([id, label, Icon]) => ({ id, label, icon: <Icon size={15} /> }))} />

      {/* 1. Бонусы — конструктор акций */}
      {tab === 'promo' && (
        <div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            <span>Приветственный бонус: <b className="text-emerald-700">{formatTenge(welcomeBonusOf(pos.promoActions))}</b></span>
            <span>Лимит оплаты бонусами: <b className="text-emerald-700">{redeemLimitPctOf(pos.promoActions)}%</b> чека</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-4">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200">
                <th className="p-2 w-8"></th><th>Акция</th><th>Действие</th><th className="text-right">%</th><th className="text-right">Сумма</th><th className="text-right">Условие ≥</th><th>Маска</th><th className="p-2"></th>
              </tr></thead>
              <tbody>
                {pos.promoActions.length === 0 ? <tr><td colSpan={8} className="p-3 text-gray-400">Акций нет.</td></tr> : pos.promoActions.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2"><input type="checkbox" checked={a.active} onChange={(e) => pos.updatePromoAction(a.id, { active: e.target.checked })} /></td>
                    <td>{a.name}</td>
                    <td className="text-gray-500">{ACTION_TYPE_LABEL[a.type]}</td>
                    <td className="text-right">{(a.type === 'accruePercent' || a.type === 'paymentLimit') ? `${a.percent ?? 0}%` : '—'}</td>
                    <td className="text-right">{(a.type === 'accrueFixed' || a.type === 'welcome') ? formatTenge(a.amount ?? 0) : '—'}</td>
                    <td className="text-right text-gray-500">{a.minSum ? formatTenge(a.minSum) : '—'}</td>
                    <td className="text-gray-500">{a.groupId ? (menuGroups.find((g) => g.id === a.groupId)?.name ?? a.groupId) : 'весь заказ'}</td>
                    <td className="p-2 text-right"><button onClick={() => pos.removePromoAction(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* форма добавления */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-500">Действие
              <select value={newAction.type} onChange={(e) => setNewAction({ ...newAction, type: e.target.value as PromoActionType })} className={`${inp} mt-1`}>
                {(Object.keys(ACTION_TYPE_LABEL) as PromoActionType[]).map((t) => <option key={t} value={t}>{ACTION_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs text-gray-500">Название
              <input value={newAction.name} onChange={(e) => setNewAction({ ...newAction, name: e.target.value })} placeholder="(авто)" className={`${inp} mt-1 w-44`} />
            </label>
            {(newAction.type === 'accruePercent' || newAction.type === 'paymentLimit') && (
              <label className="flex flex-col text-xs text-gray-500">%
                <input type="number" min={0} max={100} value={newAction.percent} onChange={(e) => setNewAction({ ...newAction, percent: e.target.value })} className={`${inp} mt-1 w-20 text-right`} />
              </label>
            )}
            {(newAction.type === 'accrueFixed' || newAction.type === 'welcome') && (
              <label className="flex flex-col text-xs text-gray-500">Сумма, ₸
                <input type="number" min={0} value={newAction.amount} onChange={(e) => setNewAction({ ...newAction, amount: e.target.value })} className={`${inp} mt-1 w-24 text-right`} />
              </label>
            )}
            {newAction.type !== 'welcome' && newAction.type !== 'paymentLimit' && (
              <label className="flex flex-col text-xs text-gray-500">Заказ не менее, ₸
                <input type="number" min={0} value={newAction.minSum} onChange={(e) => setNewAction({ ...newAction, minSum: e.target.value })} className={`${inp} mt-1 w-28 text-right`} />
              </label>
            )}
            {newAction.type === 'accruePercent' && (
              <label className="flex flex-col text-xs text-gray-500">Маска (категория)
                <select value={newAction.groupId} onChange={(e) => setNewAction({ ...newAction, groupId: e.target.value })} className={`${inp} mt-1`}>
                  <option value="">весь заказ</option>
                  {menuGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}
            <button onClick={addAction} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm flex items-center gap-1"><Plus size={15} />Добавить акцию</button>
          </div>
        </div>
      )}

      {/* 2. Депозит — кошелёк */}
      {tab === 'deposit' && (
        <div>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input type="checkbox" checked={pos.depositProgram.active} onChange={(e) => pos.setDepositProgram({ active: e.target.checked })} />
            Депозитная («Денежная») программа активна — оплата с кошелька гостя на кассе
          </label>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-4">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Карта</th><th>Владелец</th><th className="text-right">Бонусы</th><th className="text-right p-2">Кошелёк (депозит)</th></tr></thead>
              <tbody>
                {pos.loyaltyCards.length === 0 ? <tr><td colSpan={4} className="p-3 text-gray-400">Карт нет.</td></tr> : pos.loyaltyCards.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2 font-mono">{c.number}</td><td>{c.owner}</td>
                    <td className="text-right text-gray-500">{formatTenge(c.balance)}</td>
                    <td className="text-right p-2 font-medium text-emerald-700">{formatTenge(c.deposit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-500">Карта
              <select value={topUp.cardId} onChange={(e) => setTopUp({ ...topUp, cardId: e.target.value })} className={`${inp} mt-1`}>
                <option value="">— выбрать —</option>
                {pos.loyaltyCards.map((c) => <option key={c.id} value={c.id}>{c.number} · {c.owner}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs text-gray-500">Сумма пополнения, ₸
              <input type="number" min={0} value={topUp.amount} onChange={(e) => setTopUp({ ...topUp, amount: e.target.value })} className={`${inp} mt-1 w-32 text-right`} />
            </label>
            <button onClick={doTopUp} disabled={!topUp.cardId || !(num(topUp.amount) > 0)} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm flex items-center gap-1 disabled:opacity-40"><Wallet size={15} />Пополнить кошелёк</button>
          </div>
        </div>
      )}

      {/* 3. Сертификаты */}
      {tab === 'certs' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-4">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Номер</th><th className="text-right">Номинал</th><th>Кому</th><th>Действует до</th><th>Статус</th><th className="p-2"></th></tr></thead>
              <tbody>
                {pos.certificates.length === 0 ? <tr><td colSpan={6} className="p-3 text-gray-400">Сертификатов нет.</td></tr> : pos.certificates.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2 font-mono">{c.number}</td>
                    <td className="text-right font-medium">{formatTenge(c.nominal)}</td>
                    <td className="text-gray-500">{c.owner ?? '—'}</td>
                    <td className="text-gray-500">{formatRu(c.expiresAt)}</td>
                    <td><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : c.status === 'used' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'}`}>{STATUS_LABEL[c.status]}</span></td>
                    <td className="p-2 text-right"><button onClick={() => pos.voidCertificate(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-500">Номер
              <input value={newCert.number} onChange={(e) => setNewCert({ ...newCert, number: e.target.value })} placeholder="GIFT-…" className={`${inp} mt-1 w-40 font-mono`} />
            </label>
            <label className="flex flex-col text-xs text-gray-500">Номинал, ₸
              <input type="number" min={0} value={newCert.nominal} onChange={(e) => setNewCert({ ...newCert, nominal: e.target.value })} className={`${inp} mt-1 w-28 text-right`} />
            </label>
            <label className="flex flex-col text-xs text-gray-500">Кому (опц.)
              <input value={newCert.owner} onChange={(e) => setNewCert({ ...newCert, owner: e.target.value })} className={`${inp} mt-1 w-40`} />
            </label>
            <label className="flex flex-col text-xs text-gray-500">Срок, дней
              <input type="number" min={1} value={newCert.days} onChange={(e) => setNewCert({ ...newCert, days: e.target.value })} className={`${inp} mt-1 w-24 text-right`} />
            </label>
            <button onClick={issueCert} disabled={!newCert.number.trim() || !(num(newCert.nominal) > 0)} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm flex items-center gap-1 disabled:opacity-40"><Ticket size={15} />Выпустить сертификат</button>
          </div>
        </div>
      )}

      {/* 4. Карты гостей */}
      {tab === 'cards' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Номер</th><th>Владелец</th><th>Телефон</th><th className="text-right">Бонусы</th><th className="text-right">Кошелёк</th><th className="p-2"></th></tr></thead>
              <tbody>
                {pos.loyaltyCards.length === 0 ? <tr><td colSpan={6} className="p-3 text-gray-400">Карт нет.</td></tr> : pos.loyaltyCards.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2 font-mono">{c.number}</td><td>{c.owner}</td><td className="text-gray-500">{c.phone}</td>
                    <td className="text-right font-medium text-emerald-700">{formatTenge(c.balance)}</td>
                    <td className="text-right text-gray-600">{formatTenge(c.deposit)}</td>
                    <td className="p-2 text-right"><button onClick={() => pos.removeLoyaltyCard(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <input value={newCard.number} onChange={(e) => setNewCard({ ...newCard, number: e.target.value })} placeholder="Номер карты" className={`${inp} w-36 font-mono`} />
            <input value={newCard.owner} onChange={(e) => setNewCard({ ...newCard, owner: e.target.value })} placeholder="Владелец" className={`${inp} flex-1 min-w-[140px]`} />
            <input value={newCard.phone} onChange={(e) => setNewCard({ ...newCard, phone: e.target.value })} placeholder="Телефон" className={`${inp} w-44`} />
            <button onClick={issueCard} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Выпустить карту (+{formatTenge(welcomeBonusOf(pos.promoActions))})</button>
          </div>
        </div>
      )}
    </div>
  )
}
