import { useState } from 'react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'

// Журнал событий (Журналы, модуль 13) — хронология операций кассы/офиса за сессию:
// продажи, возвраты, касса, списания, склад, цены, зарплата. Источник — оперативный слой стора.
export default function OfficeJournal() {
  const { closedOrders, refunds, cashMovements, writeOffs, documents, priceOrders, salaryPayouts, staffList } = usePos()
  const [journalCat, setJournalCat] = useState<string>('all')

  const ev: { at: string; cat: string; label: string; who: string; sum?: string }[] = []
  for (const o of closedOrders) ev.push({ at: o.paidAt, cat: 'Продажи', label: `Чек №${o.id} · ФД ${o.fiscalDocNo}`, who: o.waiter, sum: formatTenge(o.total) })
  for (const r of refunds) ev.push({ at: r.at, cat: 'Возвраты', label: `Возврат по заказу №${r.orderId} · ${r.reason}`, who: r.by, sum: '− ' + formatTenge(r.amount) })
  for (const m of cashMovements) ev.push({ at: m.at, cat: 'Касса', label: `${m.kind === 'in' ? 'Внесение' : 'Изъятие'} · ${m.type}${m.comment ? ' · ' + m.comment : ''}`, who: '', sum: (m.kind === 'in' ? '+ ' : '− ') + formatTenge(m.amount) })
  for (const w of writeOffs) ev.push({ at: w.at, cat: 'Списания', label: `${w.name} ×${w.qty} · ${w.reason}`, who: '', sum: formatTenge(w.cost) })
  for (const d of documents) ev.push({ at: d.at, cat: 'Склад', label: `${d.type}${d.reason ? ' · ' + d.reason : ''} · ${d.store}`, who: d.by, sum: `${d.lines.length} поз.` })
  for (const p of priceOrders.filter((x) => x.status === 'active')) ev.push({ at: p.createdAt, cat: 'Цены', label: `Приказ ${p.no} активирован · ${p.lines.length} позиций`, who: '', sum: '' })
  for (const s of salaryPayouts) ev.push({ at: s.at, cat: 'Зарплата', label: `${s.kind === 'advance' ? 'Аванс' : 'Расчёт'} · ${staffList.find((x) => x.id === s.staffId)?.name ?? s.staffId}`, who: s.by, sum: '− ' + formatTenge(s.amount) })

  const cats = ['all', 'Продажи', 'Возвраты', 'Касса', 'Списания', 'Склад', 'Цены', 'Зарплата']
  const parseAt = (s: string) => { const m = /(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s); return m ? `${m[3]}${m[2]}${m[1]}${m[4]}${m[5]}${m[6] ?? '00'}` : s }
  const rows = ev.filter((e) => journalCat === 'all' || e.cat === journalCat).sort((a, b) => parseAt(b.at).localeCompare(parseAt(a.at)))
  const badge: Record<string, string> = { Продажи: 'bg-emerald-100 text-emerald-700', Возвраты: 'bg-rose-100 text-rose-700', Касса: 'bg-blue-100 text-blue-700', Списания: 'bg-orange-100 text-orange-700', Склад: 'bg-violet-100 text-violet-700', Цены: 'bg-amber-100 text-amber-700', Зарплата: 'bg-teal-100 text-teal-700' }

  return (
    <div className="p-6 max-w-4xl">
      <div className="text-xs text-gray-500 mb-4">
        Журнал событий (Журналы, монитор операций) — хронология действий кассы и офиса за текущую сессию: продажи, возвраты,
        касса, списания, склад, цены, выплаты. Источник — оперативный слой мок-стора.
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {cats.map((c) => (
          <button key={c} onClick={() => setJournalCat(c)}
            className={`h-8 px-3 rounded-full text-sm ${journalCat === c ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{c === 'all' ? 'Все' : c}</button>
        ))}
        <span className="ml-auto self-center text-xs text-gray-400">событий: {rows.length}</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-md overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Время</th><th>Тип</th><th>Событие</th><th>Кто</th><th className="text-right p-2">Сумма</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-gray-400">Событий нет.</td></tr>}
            {rows.map((e, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="p-2 text-gray-500 whitespace-nowrap text-xs">{e.at}</td>
                <td><span className={`text-xs px-2 py-0.5 rounded-full ${badge[e.cat] ?? 'bg-gray-100 text-gray-600'}`}>{e.cat}</span></td>
                <td>{e.label}</td>
                <td className="text-gray-500 text-xs">{e.who || '—'}</td>
                <td className="text-right p-2 whitespace-nowrap">{e.sum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
