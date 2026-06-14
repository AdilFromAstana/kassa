import { useState } from 'react'
import { Plus } from 'lucide-react'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import { contractorBalances, contractorSverka } from '../lib/contractors'

// Контрагенты (раздел 08) — взаиморасчёты по документам + акт сверки.
// Источник: приходные накладные (мы должны) и исходящие ЭСФ (нам должны). Оплаты в моке не фиксируются.
export default function OfficeContractors() {
  const pos = usePos()
  const balances = contractorBalances(pos.contractors, pos.invoices)
  const [sel, setSel] = useState<string | null>(balances[0]?.name ?? null)
  const [cName, setCName] = useState(''); const [cBin, setCBin] = useState('')
  const sverka = sel ? contractorSverka(sel, pos.invoices) : []
  const finalBal = sverka.length ? sverka[sverka.length - 1].balance : 0
  const tot = balances.reduce((a, b) => ({ purchases: a.purchases + b.purchases, sales: a.sales + b.sales }), { purchases: 0, sales: 0 })

  const balCls = (v: number) => v > 0 ? 'text-emerald-700' : v < 0 ? 'text-rose-600' : 'text-gray-500'
  const balNote = (v: number) => v > 0 ? 'нам должны' : v < 0 ? 'мы должны' : '—'

  return (
    <div className="p-6 max-w-4xl">
      <div className="text-xs text-gray-500 mb-4">
        Взаиморасчёты с контрагентами (раздел 08). Сальдо «по документам»: <b>Продажи</b> (исх. ЭСФ, нам должны) − <b>Закупки</b> (вх. накладные, мы должны).
        Оплаты в моке не фиксируются. БИН/ИИН — идентификатор РК.
      </div>

      {/* список контрагентов с сальдо */}
      <div className="text-gray-500 text-xs uppercase mb-2">Контрагенты ({balances.length})</div>
      <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3">
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-left border-b border-gray-200">
            <th className="p-2">Наименование</th><th>БИН/ИИН</th><th className="text-right">Закупки (вх.)</th><th className="text-right">Продажи (исх.)</th><th className="text-right">Док-тов</th><th className="text-right p-2">Сальдо</th>
          </tr></thead>
          <tbody>
            {balances.length === 0 ? <tr><td colSpan={6} className="p-3 text-gray-400">Контрагентов нет.</td></tr> : balances.map((b) => (
              <tr key={b.id} onClick={() => setSel(b.name)}
                className={`border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 ${sel === b.name ? 'bg-emerald-50/50' : ''}`}>
                <td className="p-2">{b.name}</td>
                <td className="text-gray-500 font-mono text-xs">{b.bin}</td>
                <td className="text-right text-gray-600">{b.purchases ? formatTenge(b.purchases) : '—'}</td>
                <td className="text-right text-gray-600">{b.sales ? formatTenge(b.sales) : '—'}</td>
                <td className="text-right text-gray-400">{b.docCount}</td>
                <td className={`text-right p-2 font-medium ${balCls(b.balance)}`} title={balNote(b.balance)}>{formatTenge(b.balance)}</td>
              </tr>
            ))}
          </tbody>
          {balances.length > 0 && (
            <tfoot><tr className="border-t border-gray-200 font-semibold"><td className="p-2">Итого</td><td /><td className="text-right">{formatTenge(tot.purchases)}</td><td className="text-right">{formatTenge(tot.sales)}</td><td /><td className={`text-right p-2 ${balCls(tot.sales - tot.purchases)}`}>{formatTenge(+(tot.sales - tot.purchases).toFixed(2))}</td></tr></tfoot>
          )}
        </table>
      </div>

      {/* добавление контрагента */}
      <div className="flex gap-2 mb-6">
        <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Наименование" className="h-9 rounded border border-gray-300 px-2 flex-1" />
        <input value={cBin} onChange={(e) => setCBin(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="БИН / ИИН" className="h-9 rounded border border-gray-300 px-2 w-40 font-mono" />
        <button onClick={() => { if (cName.trim() && cBin.trim()) { pos.addContractor(cName.trim(), cBin.trim()); setCName(''); setCBin('') } }} className="h-9 px-4 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1"><Plus size={14} />Добавить</button>
      </div>

      {/* акт сверки выбранного контрагента */}
      <div className="flex items-center mb-2">
        <div className="text-gray-500 text-xs uppercase">Акт сверки{sel ? `: ${sel}` : ''}</div>
        {sel && <div className={`ml-auto text-sm font-medium ${balCls(finalBal)}`}>Сальдо на конец: {formatTenge(finalBal)} <span className="text-gray-400 text-xs">({balNote(finalBal)})</span></div>}
      </div>
      <div className="bg-white border border-gray-200 rounded-md overflow-auto">
        {!sel ? <div className="p-3 text-gray-400 text-sm">Выберите контрагента в таблице выше.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-left border-b border-gray-200">
              <th className="p-2">Дата</th><th>Документ</th><th>Операция</th><th className="text-right">Сумма</th><th className="text-right">в т.ч. ҚҚС</th><th className="text-right p-2">Сальдо</th>
            </tr></thead>
            <tbody>
              {sverka.length === 0 ? <tr><td colSpan={6} className="p-3 text-gray-400">Документов по контрагенту нет.</td></tr> : sverka.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="p-2 text-gray-500 text-xs whitespace-nowrap">{r.date.split(',')[0]}</td>
                  <td>{r.no}</td>
                  <td className="text-gray-500 text-xs">{r.kind}</td>
                  <td className={`text-right ${r.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatTenge(r.amount)}</td>
                  <td className="text-right text-gray-500">{formatTenge(r.vat)}</td>
                  <td className={`text-right p-2 font-medium ${balCls(r.balance)}`}>{formatTenge(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2">Сумма: закупки (вх.) — отрицательно (мы должны), продажи (исх.) — положительно (нам должны). Сальдо — накопительно по датам.</div>
    </div>
  )
}
