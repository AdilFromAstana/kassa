import { useState } from 'react'
import { usePos } from '../store/pos'
import { chartOfAccountsSeed as CHART } from '../mock/data'
import { buildAutoPostings } from '../lib/ledger'
import { formatTenge } from '../lib/money'
import { downloadExcel, xlsNum } from '../lib/export'
import { printToast } from '../lib/print'
import Tabs from '../components/Tabs'

// Обмен данными (раздел 11) — справочник проводок (правила формирования) + выгрузка в 1С.
// Правила 1:1 с lib/ledger (единый источник авто-проводок). Выгрузка — проводки за период.
type Tab = 'rules' | 'export'

const acctLabel = (code: string) => { const a = CHART.find((x) => x.code === code); return a ? `${a.code} ${a.name}` : code }

// Справочник правил: операция → Дт/Кт (соответствует buildAutoPostings)
const RULES: { op: string; d: string; c: string; note: string }[] = [
  { op: 'Продажа за наличные', d: '1010', c: '6010', note: 'деньги в кассе ↑, выручка ↑' },
  { op: 'Продажа безнал/прочее', d: '1030', c: '6010', note: 'деньги в банке ↑, выручка ↑' },
  { op: 'ҚҚС 16% с продажи', d: '6010', c: '3130', note: 'выделение налога из выручки' },
  { op: 'Себестоимость продажи', d: '7010', c: '1330', note: 'списание товаров по техкартам' },
  { op: 'Приход товара (накладная)', d: '1330', c: '3310', note: 'товары ↑, долг поставщику ↑' },
  { op: 'Входящий ҚҚС (к зачёту)', d: '1420', c: '3310', note: 'НДС к зачёту' },
  { op: 'Начисление зарплаты', d: '7210', c: '3350', note: 'расход ↑, задолженность по ЗП ↑' },
  { op: 'Выплата зарплаты', d: '3350', c: '1010', note: 'погашение ЗП из кассы' },
  { op: 'Инкассация / изъятие (касса→банк)', d: '1030', c: '1010', note: 'деньги из кассы в банк' },
  { op: 'Внесение (банк→касса)', d: '1010', c: '1030', note: 'деньги из банка в кассу' },
]

export default function OfficeExchange() {
  const pos = usePos()
  const [tab, setTab] = useState<Tab>('rules')
  const postings = [...pos.manualPostings, ...buildAutoPostings({ closedOrders: pos.closedOrders, invoices: pos.invoices, cashMovements: pos.cashMovements, ingredients: pos.ingredients })]
  const total = +postings.reduce((s, p) => s + p.amount, 0).toFixed(2)

  const exportJson = () => {
    const data = {
      сформирован: 'демо · iiko → 1С:Бухгалтерия для Казахстана',
      период: 'текущая смена (мок)',
      проводок: postings.length,
      проводки: postings.map((p) => ({ дата: p.date, дебет: p.debit, кредит: p.credit, сумма: p.amount, назначение: p.desc })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'iiko-проводки-1с.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  const exportXls = () => downloadExcel('iiko-проводки', [['Дата', 'Дебет', 'Кредит', 'Сумма', 'Назначение'],
    ...postings.map((p) => [p.date.split(',')[0], p.debit, p.credit, xlsNum(p.amount), p.desc])])

  return (
    <div className="p-6 max-w-4xl">
      <div className="text-xs text-gray-500 mb-4">Обмен данными (раздел 11) — справочник правил формирования проводок и выгрузка в 1С:Бухгалтерия для Казахстана (типовой план счетов РК).</div>
      <Tabs active={tab} onChange={setTab} items={[{ id: 'rules', label: 'Справочник проводок' }, { id: 'export', label: 'Выгрузка в 1С' }]} />

      {tab === 'rules' && (
        <>
          <div className="text-xs text-gray-400 mb-2">Правила соответствуют авто-проводкам бухгалтерии (единый источник — lib/ledger). Дт/Кт — по плану счетов РК.</div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Операция</th><th>Дебет</th><th>Кредит</th><th>Пояснение</th></tr></thead>
              <tbody>
                {RULES.map((r) => (
                  <tr key={r.op} className="border-b border-gray-100 last:border-0">
                    <td className="p-2">{r.op}</td>
                    <td className="font-mono text-xs text-gray-600">{acctLabel(r.d)}</td>
                    <td className="font-mono text-xs text-gray-600">{acctLabel(r.c)}</td>
                    <td className="text-gray-500 text-xs">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'export' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat k="Проводок к выгрузке" v={String(postings.length)} />
            <Stat k="Сумма оборотов" v={formatTenge(total)} />
            <Stat k="Формат" v="1С (JSON) / Excel" />
          </div>
          <div className="flex gap-2 mb-5">
            <button onClick={exportJson} className="h-10 px-4 rounded bg-slate-700 text-white text-sm">Выгрузить проводки в 1С (JSON)</button>
            <button onClick={exportXls} className="h-10 px-4 rounded bg-emerald-600 text-white text-sm">Excel…</button>
            <button onClick={() => printToast('Экстренный обмен с 1С выполнен (мок)')} className="h-10 px-4 rounded border border-gray-300 text-gray-700 text-sm">Экстренный обмен</button>
          </div>
          <div className="text-gray-500 text-xs uppercase mb-2">Журнал обмена</div>
          <div className="bg-white border border-gray-200 rounded-md p-3 text-xs font-mono text-gray-600 space-y-0.5">
            <div>03:00:12 → выгрузка проводок в 1С: {postings.length} док., план счетов РК — OK</div>
            <div>02:00:05 → синхронизация справочников (номенклатура/контрагенты) — OK</div>
            <div className="text-amber-600">вчера 23:50 ⚠ ЭСФ ИС: 1 документ ожидает подписи ЭЦП</div>
          </div>
          <div className="text-xs text-gray-400 mt-3">Реальная выгрузка в 1С / ИС ЭСФ (esf.gov.kz) — на бэкенде (.NET).</div>
        </>
      )}
    </div>
  )
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="bg-white border border-gray-200 rounded-md p-3"><div className="text-xs text-gray-400">{k}</div><div className="text-lg font-bold text-gray-800">{v}</div></div>
)
