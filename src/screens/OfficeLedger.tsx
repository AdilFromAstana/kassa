import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { usePos } from '../store/pos'
import { chartOfAccountsSeed as CHART, openingBalancesSeed as OPENING } from '../mock/data'
import { dishCost } from '../mock/warehouse'
import { formatTenge, vatAmount } from '../lib/money'
import { todayISO } from '../lib/date'
import type { JournalEntry } from '../types'

// Бухгалтерия (модуль 07): двойная запись — план счетов РК, авто-проводки от операций кассы/закупок/ЗП,
// ручные проводки, оборотно-сальдовая ведомость (ОСВ) и баланс. Σ Дт всегда = Σ Кт.
type Tab = 'accounts' | 'journal' | 'osv' | 'balance'
const accByCode = (code: string) => CHART.find((a) => a.code === code)
const accLabel = (code: string) => { const a = accByCode(code); return a ? `${a.code} ${a.name}` : code }

export default function OfficeLedger() {
  const pos = usePos()
  const [tab, setTab] = useState<Tab>('journal')
  const [form, setForm] = useState({ date: todayISO(), debit: '1010', credit: '6010', amount: '', desc: '' })

  // ── авто-проводки из операций (детерминированно) ──
  const auto: JournalEntry[] = []
  let seq = 0
  const e = (date: string, debit: string, credit: string, amount: number, desc: string) => {
    if (amount > 0.005) auto.push({ id: 'a' + (++seq), date, debit, credit, amount: +amount.toFixed(2), desc, source: 'auto' })
  }
  // продажи (закрытые чеки): деньги → выручка, выделение ҚҚС, себестоимость
  for (const o of pos.closedOrders) {
    const vat = vatAmount(o.total, 16)
    const cash = o.payments.filter((p) => p.paymentTypeId === 'p-cash').reduce((s, p) => s + p.amount, 0)
    const bank = +(o.total - cash).toFixed(2)
    e(o.paidAt, '1010', '6010', cash, `Продажа нал. чек №${o.id}`)
    e(o.paidAt, '1030', '6010', bank, `Продажа безнал/прочее чек №${o.id}`)
    e(o.paidAt, '6010', '3130', vat, `ҚҚС 16% с продажи №${o.id}`)
    const cost = o.lines.reduce((s, l) => s + dishCost(l.dishId, pos.ingredients) * l.qty, 0)
    e(o.paidAt, '7010', '1330', cost, `Себестоимость продажи №${o.id}`)
  }
  // закупки (приходные накладные): товар + входящий ҚҚС / поставщику
  for (const inv of pos.invoices.filter((i) => i.kind !== 'out')) {
    e(inv.date, '1330', '3310', +(inv.total - inv.vat).toFixed(2), `Приход товара ${inv.no}`)
    e(inv.date, '1420', '3310', inv.vat, `Входящий ҚҚС ${inv.no}`)
  }
  // касса: зарплата (начисление+выплата), инкассация/изъятие, внесения
  for (const m of pos.cashMovements) {
    if (/зарплат|аванс/i.test(m.type)) {
      e(m.at, '7210', '3350', m.amount, `Начисление ЗП · ${m.comment}`)
      e(m.at, '3350', '1010', m.amount, `Выплата ЗП · ${m.comment}`)
    } else if (m.kind === 'out') {
      e(m.at, '1030', '1010', m.amount, `${m.type} (касса → банк)`)
    } else {
      e(m.at, '1010', '1030', m.amount, `${m.type} (банк → касса)`)
    }
  }

  const journal = [...pos.manualPostings, ...auto]
  const totalDr = +journal.reduce((s, j) => s + j.amount, 0).toFixed(2)
  // обороты по счёту
  const turnDr = (code: string) => +journal.filter((j) => j.debit === code).reduce((s, j) => s + j.amount, 0).toFixed(2)
  const turnCr = (code: string) => +journal.filter((j) => j.credit === code).reduce((s, j) => s + j.amount, 0).toFixed(2)

  // ОСВ по каждому счёту
  const osv = CHART.map((a) => {
    const nat: 'D' | 'C' = a.kind === 'A' || a.kind === 'E' ? 'D' : 'C'
    const open = OPENING[a.code] ?? 0
    const openDr = nat === 'D' ? open : 0
    const openCr = nat === 'C' ? open : 0
    const dr = turnDr(a.code), cr = turnCr(a.code)
    const bal = nat === 'D' ? open + dr - cr : open + cr - dr
    const closeDr = nat === 'D' ? Math.max(0, bal) : Math.max(0, -bal)
    const closeCr = nat === 'C' ? Math.max(0, bal) : Math.max(0, -bal)
    return { a, openDr, openCr, dr, cr, closeDr, closeCr, bal }
  })
  const natBal = (code: string) => osv.find((r) => r.a.code === code)?.bal ?? 0

  const submit = () => {
    const amt = parseFloat(form.amount.replace(',', '.')) || 0
    if (amt <= 0 || form.debit === form.credit) return
    pos.addPosting({ date: form.date, debit: form.debit, credit: form.credit, amount: amt, desc: form.desc.trim() || 'Ручная проводка' })
    setForm({ ...form, amount: '', desc: '' })
  }

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([['accounts', 'План счетов'], ['journal', 'Журнал проводок'], ['osv', 'ОСВ'], ['balance', 'Баланс']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 h-9 text-sm -mb-px border-b-2 ${tab === id ? 'border-emerald-500 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      {tab === 'accounts' && (
        <div className="bg-white border border-gray-200 rounded-md overflow-auto max-w-2xl">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Счёт</th><th>Наименование</th><th>Тип</th><th>Раздел</th></tr></thead>
            <tbody>
              {CHART.map((a) => (
                <tr key={a.code} className="border-b border-gray-100 last:border-0">
                  <td className="p-2 font-mono">{a.code}</td>
                  <td>{a.name}</td>
                  <td className="text-gray-500 text-xs">{a.kind === 'A' ? 'актив' : a.kind === 'P' ? 'пассив/капитал' : a.kind === 'I' ? 'доход' : 'расход'}</td>
                  <td className="text-gray-500 text-xs">{a.section}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'journal' && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex flex-wrap items-end gap-2">
            <input type="date" value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} className="h-9 rounded border border-gray-300 px-2 text-sm" />
            <label className="flex flex-col text-xs text-gray-500">Дебет
              <select value={form.debit} onChange={(ev) => setForm({ ...form, debit: ev.target.value })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm">{CHART.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select></label>
            <label className="flex flex-col text-xs text-gray-500">Кредит
              <select value={form.credit} onChange={(ev) => setForm({ ...form, credit: ev.target.value })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm">{CHART.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select></label>
            <input value={form.amount} onChange={(ev) => setForm({ ...form, amount: ev.target.value.replace(/[^\d.,]/g, '') })} placeholder="Сумма ₸" className="h-9 w-28 rounded border border-gray-300 px-2 text-sm text-right" />
            <input value={form.desc} onChange={(ev) => setForm({ ...form, desc: ev.target.value })} placeholder="Назначение" className="h-9 rounded border border-gray-300 px-2 text-sm flex-1 min-w-[140px]" />
            <button onClick={submit} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Провести</button>
          </div>
          <div className="text-xs text-gray-400 mb-2">Проводок: {journal.length} (ручных {pos.manualPostings.length} + авто {auto.length}). Σ Дт = Σ Кт = {formatTenge(totalDr)}.</div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto" style={{ maxHeight: '60vh' }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Дата</th><th>Дебет</th><th>Кредит</th><th className="text-right">Сумма</th><th>Назначение</th><th className="p-2"></th></tr></thead>
              <tbody>
                {journal.map((j) => (
                  <tr key={j.id} className="border-b border-gray-50">
                    <td className="p-2 text-gray-500 text-xs whitespace-nowrap">{j.date.split(',')[0]}</td>
                    <td className="font-mono text-xs">{j.debit}</td>
                    <td className="font-mono text-xs">{j.credit}</td>
                    <td className="text-right">{formatTenge(j.amount)}</td>
                    <td className="text-gray-600 text-xs">{j.desc} {j.source === 'manual' && <span className="text-emerald-600">· ручн.</span>}</td>
                    <td className="p-2 text-right">{j.source === 'manual' && <button onClick={() => pos.removePosting(j.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'osv' && (
        <div className="bg-white border border-gray-200 rounded-md overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="p-2 text-left" rowSpan={2}>Счёт</th>
                <th className="text-center border-l border-gray-100" colSpan={2}>Сальдо начальное</th>
                <th className="text-center border-l border-gray-100" colSpan={2}>Обороты</th>
                <th className="text-center border-l border-gray-100" colSpan={2}>Сальдо конечное</th>
              </tr>
              <tr className="text-gray-400 text-xs border-b border-gray-200">
                <th className="text-right border-l border-gray-100 px-2">Дт</th><th className="text-right px-2">Кт</th>
                <th className="text-right border-l border-gray-100 px-2">Дт</th><th className="text-right px-2">Кт</th>
                <th className="text-right border-l border-gray-100 px-2">Дт</th><th className="text-right px-2">Кт</th>
              </tr>
            </thead>
            <tbody>
              {osv.map((r) => (
                <tr key={r.a.code} className="border-b border-gray-50">
                  <td className="p-2"><span className="font-mono text-xs text-gray-400 mr-1">{r.a.code}</span>{r.a.name}</td>
                  <td className="text-right px-2 text-gray-600">{r.openDr ? formatTenge(r.openDr) : ''}</td>
                  <td className="text-right px-2 text-gray-600">{r.openCr ? formatTenge(r.openCr) : ''}</td>
                  <td className="text-right px-2">{r.dr ? formatTenge(r.dr) : ''}</td>
                  <td className="text-right px-2">{r.cr ? formatTenge(r.cr) : ''}</td>
                  <td className="text-right px-2 font-medium">{r.closeDr ? formatTenge(r.closeDr) : ''}</td>
                  <td className="text-right px-2 font-medium">{r.closeCr ? formatTenge(r.closeCr) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="p-2">ИТОГО</td>
                <td className="text-right px-2">{formatTenge(osv.reduce((s, r) => s + r.openDr, 0))}</td>
                <td className="text-right px-2">{formatTenge(osv.reduce((s, r) => s + r.openCr, 0))}</td>
                <td className="text-right px-2">{formatTenge(totalDr)}</td>
                <td className="text-right px-2">{formatTenge(totalDr)}</td>
                <td className="text-right px-2">{formatTenge(osv.reduce((s, r) => s + r.closeDr, 0))}</td>
                <td className="text-right px-2">{formatTenge(osv.reduce((s, r) => s + r.closeCr, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'balance' && (() => {
        const assets = CHART.filter((a) => a.kind === 'A')
        const passive = CHART.filter((a) => a.kind === 'P')
        const profit = +(natBal('6010') - natBal('7010') - natBal('7210')).toFixed(2)
        const totalA = +assets.reduce((s, a) => s + natBal(a.code), 0).toFixed(2)
        const totalP = +(passive.reduce((s, a) => s + natBal(a.code), 0) + profit).toFixed(2)
        const Row = ({ k, v, b }: { k: string; v: number; b?: boolean }) => (
          <div className={`flex justify-between py-1 ${b ? 'font-semibold border-t border-gray-200 mt-1 pt-1' : 'text-gray-600'}`}><span>{k}</span><span>{formatTenge(v)}</span></div>
        )
        return (
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-emerald-700 text-sm font-medium mb-2">АКТИВ</div>
              {assets.map((a) => <Row key={a.code} k={`${a.code} ${a.name}`} v={natBal(a.code)} />)}
              <Row k="Баланс (актив)" v={totalA} b />
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-blue-700 text-sm font-medium mb-2">ПАССИВ</div>
              {passive.map((a) => <Row key={a.code} k={`${a.code} ${a.name}`} v={natBal(a.code)} />)}
              <Row k="Финансовый результат (прибыль)" v={profit} />
              <Row k="Баланс (пассив)" v={totalP} b />
            </div>
            <div className="col-span-2 text-xs text-gray-400">
              {Math.abs(totalA - totalP) < 0.5 ? '✓ Баланс сходится: Актив = Пассив + Капитал.' : `⚠ Расхождение ${formatTenge(totalA - totalP)}`}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
