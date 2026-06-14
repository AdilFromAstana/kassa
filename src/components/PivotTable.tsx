import { useState } from 'react'
import { formatTenge } from '../lib/money'
import { downloadExcel, xlsNum } from '../lib/export'
import { collectPaths, rowNodes, cellFacts, dataColumns, type PivotMeasure } from '../lib/pivot'

// Компактная сводная таблица (OLAP) поверх чистого движка lib/pivot.
// Переиспользуется новыми отчётами (Настраиваемый 616, OLAP по проводкам). Без DnD/сохранённых
// представлений (это есть в богатом OfficeOlap «OLAP по продажам») — выбор измерений кнопками.
type Fact = Record<string, unknown>
type Zone = 'none' | 'row' | 'col'

interface Props {
  facts: Fact[]
  dims: { key: string; label: string }[]
  measures: PivotMeasure<Fact>[]
  initialRows?: string[]
  initialCols?: string[]
  initialMeasures?: string[]
  excelName?: string
  note?: string
}

export default function PivotTable({ facts, dims, measures, initialRows = [], initialCols = [], initialMeasures, excelName = 'iiko-OLAP', note }: Props) {
  const [rows, setRows] = useState<string[]>(initialRows)
  const [cols, setCols] = useState<string[]>(initialCols)
  const [mids, setMids] = useState<string[]>(initialMeasures ?? measures.map((m) => m.id))

  const zoneOf = (k: string): Zone => (rows.includes(k) ? 'row' : cols.includes(k) ? 'col' : 'none')
  const setZone = (k: string, z: Zone) => {
    setRows((r) => r.filter((x) => x !== k)); setCols((c) => c.filter((x) => x !== k))
    if (z === 'row') setRows((r) => [...r.filter((x) => x !== k), k])
    if (z === 'col') setCols((c) => [...c.filter((x) => x !== k), k])
  }
  const activeMeasures = measures.filter((m) => mids.includes(m.id))
  const toggleM = (id: string) => setMids((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const colLeaves = collectPaths(facts, cols)
  const dataCols = dataColumns(facts, cols)
  const nodes = rows.length ? rowNodes(facts, rows) : []
  const labelOf = (k: string) => dims.find((d) => d.key === k)?.label ?? k
  const colLabel = (dc: { path: string[]; total?: boolean }) => (dc.total ? 'Итого' : dc.path.join(' / ') || 'Все')
  const fmt = (m: PivotMeasure<Fact>, v: number) => (m.money ? formatTenge(v) : String(+v.toFixed(2)))
  const headerRowsLabel = rows.map(labelOf).join(' / ') || '—'

  const exportXls = () => {
    if (!activeMeasures.length) return
    const header = [headerRowsLabel, ...dataCols.flatMap((dc) => activeMeasures.map((m) => `${colLabel(dc)} · ${m.label}`))]
    const body = (rows.length ? nodes : [{ path: [] as string[], depth: 0, leaf: true }]).map((n) => [
      '  '.repeat(n.depth) + (n.path.length ? n.path[n.path.length - 1] : 'Итого'),
      ...dataCols.flatMap((dc) => { const fs = cellFacts(facts, rows, n.path, cols, dc.path); return activeMeasures.map((m) => xlsNum(m.value(fs))) }),
    ])
    const totalRow = ['Итого', ...dataCols.flatMap((dc) => { const fs = cellFacts(facts, rows, [], cols, dc.path); return activeMeasures.map((m) => xlsNum(m.value(fs))) })]
    downloadExcel(excelName, [header, ...body, ...(rows.length ? [totalRow] : [])])
  }

  return (
    <div>
      {/* конструктор: измерения по зонам + показатели */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">Измерения</span>
          {dims.map((d) => {
            const z = zoneOf(d.key)
            return (
              <span key={d.key} className="inline-flex items-center rounded border border-gray-300 overflow-hidden text-xs">
                <span className="px-2 py-1 bg-gray-50 text-gray-700">{d.label}</span>
                {([['row', 'Стр'], ['col', 'Кол'], ['none', '—']] as const).map(([zz, l]) => (
                  <button key={zz} onClick={() => setZone(d.key, zz)}
                    className={`px-2 py-1 border-l border-gray-200 ${z === zz ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{l}</button>
                ))}
              </span>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">Показатели</span>
          {measures.map((m) => (
            <button key={m.id} onClick={() => toggleM(m.id)}
              className={`h-7 px-2.5 rounded text-xs border ${mids.includes(m.id) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-300'}`}>{m.label}</button>
          ))}
        </div>
        <button onClick={exportXls} disabled={!activeMeasures.length} className="ml-auto h-8 px-3 rounded bg-emerald-600 text-white text-xs disabled:opacity-40">Excel…</button>
      </div>

      {activeMeasures.length === 0 ? (
        <div className="p-4 text-sm text-gray-400 bg-white border border-gray-200 rounded-md">Выберите хотя бы один показатель.</div>
      ) : rows.length > 0 && nodes.length === 0 ? (
        <div className="p-4 text-sm text-gray-400 bg-white border border-gray-200 rounded-md">Нет данных.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-auto" style={{ maxHeight: '62vh' }}>
          <table className="text-sm border-collapse min-w-full">
            <thead className="bg-gray-50">
              {cols.length > 0 && (
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-1.5 border border-gray-200 text-gray-500 align-bottom min-w-[200px]" rowSpan={2}>{headerRowsLabel}</th>
                  {colLeaves.map((p, i) => <th key={i} colSpan={activeMeasures.length} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-center">{p.join(' / ')}</th>)}
                  <th colSpan={activeMeasures.length} className="px-3 py-1.5 border border-gray-200 text-gray-700 text-center bg-gray-100">Итого</th>
                </tr>
              )}
              <tr>
                {cols.length === 0 && <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-1.5 border border-gray-200 text-gray-500 min-w-[200px]">{headerRowsLabel}</th>}
                {dataCols.map((dc, ci) => activeMeasures.map((m) => (
                  <th key={ci + '-' + m.id} className={`px-3 py-1.5 border border-gray-200 text-right text-gray-500 font-medium whitespace-nowrap ${dc.total ? 'bg-gray-100' : ''}`}>{m.label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border border-gray-200 font-medium">Итого</td>
                  {dataCols.map((dc, ci) => { const fs = cellFacts(facts, rows, [], cols, dc.path); return activeMeasures.map((m) => (
                    <td key={ci + '-' + m.id} className={`px-3 py-1.5 border border-gray-200 text-right tabular-nums ${dc.total ? 'bg-gray-50 font-medium' : ''}`}>{fmt(m, m.value(fs))}</td>
                  )) })}
                </tr>
              ) : nodes.map((n) => (
                <tr key={n.path.join('|')} className={n.leaf ? 'hover:bg-gray-50' : 'bg-gray-50/60 font-medium'}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 border border-gray-200 whitespace-nowrap" style={{ paddingLeft: 12 + n.depth * 18 }}>{n.path[n.path.length - 1]}</td>
                  {dataCols.map((dc, ci) => { const fs = cellFacts(facts, rows, n.path, cols, dc.path); return activeMeasures.map((m) => (
                    <td key={ci + '-' + m.id} className={`px-3 py-1.5 border border-gray-200 text-right tabular-nums ${dc.total ? 'bg-gray-50' : ''}`}>{fmt(m, m.value(fs))}</td>
                  )) })}
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-gray-100 font-semibold">
                  <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5 border border-gray-200">Итого</td>
                  {dataCols.map((dc, ci) => { const fs = cellFacts(facts, rows, [], cols, dc.path); return activeMeasures.map((m) => (
                    <td key={ci + '-' + m.id} className="px-3 py-1.5 border border-gray-200 text-right tabular-nums">{fmt(m, m.value(fs))}</td>
                  )) })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {note && <div className="text-xs text-gray-400 mt-2">{note}</div>}
    </div>
  )
}
