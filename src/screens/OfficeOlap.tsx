import { useMemo, useState } from 'react'
import { Save, Trash2, X, ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import { usePos, lineTotal } from '../store/pos'
import { findDish, menuGroups } from '../mock/menu'
import { halls } from '../mock/data'
import { dishCost } from '../mock/warehouse'
import { formatTenge } from '../lib/money'
import { downloadExcel, xlsNum } from '../lib/export'

// Настоящий OLAP-куб (модуль 09, iikoOffice «OLAP Отчёт по продажам»).
// Источник фактов — закрытые чеки кассы (closedOrders), грейн = строка чека (проданное блюдо).
// Перетаскиваемые измерения по зонам Строки/Колонки/Фильтры + Данные (показатели),
// агрегаты (выручка/чеки/кол-во/средний чек/себест/прибыль), разворачивание иерархии,
// фильтры по значениям, сохранённые отчёты (persist в localStorage).
// Многооплатные чеки относятся к основному (наибольшему) типу оплаты — суммы не задваиваются.

type DimId = 'day' | 'hour' | 'waiter' | 'orderType' | 'payment' | 'dish' | 'group' | 'hall'
type MeasureId = 'revenue' | 'checks' | 'qty' | 'avg' | 'cost' | 'profit'
type Zone = 'avail' | 'rows' | 'cols' | 'filters'

const DIM_LABEL: Record<DimId, string> = {
  day: 'День', hour: 'Час', waiter: 'Официант', orderType: 'Тип заказа',
  payment: 'Тип оплаты', dish: 'Блюдо', group: 'Категория', hall: 'Зал',
}
const ALL_DIMS = Object.keys(DIM_LABEL) as DimId[]

const MEASURES: { id: MeasureId; label: string; money: boolean }[] = [
  { id: 'revenue', label: 'Выручка', money: true },
  { id: 'checks', label: 'Чеки', money: false },
  { id: 'qty', label: 'Кол-во', money: false },
  { id: 'avg', label: 'Средний чек', money: true },
  { id: 'cost', label: 'Себестоимость', money: true },
  { id: 'profit', label: 'Прибыль', money: true },
]
const MEASURE_LABEL = (m: MeasureId) => MEASURES.find((x) => x.id === m)!.label
const IS_MONEY = (m: MeasureId) => MEASURES.find((x) => x.id === m)!.money

const ORDER_TYPE_LABEL: Record<string, string> = { dinein: 'Зал', takeaway: 'Вынос', delivery: 'Доставка' }
const SEP = '\u0001'

interface Fact {
  orderId: number
  day: string; hour: string; waiter: string; orderType: string; payment: string; hall: string; dish: string; group: string
  revenue: number; revenueNoVat: number; qty: number; cost: number
}
interface Acc { revenue: number; revenueNoVat: number; qty: number; cost: number; orders: Set<number> }

const emptyAcc = (): Acc => ({ revenue: 0, revenueNoVat: 0, qty: 0, cost: 0, orders: new Set() })
const measureVal = (a: Acc, m: MeasureId): number => {
  switch (m) {
    case 'revenue': return a.revenue
    case 'checks': return a.orders.size
    case 'qty': return a.qty
    case 'cost': return a.cost
    case 'profit': return +(a.revenueNoVat - a.cost).toFixed(2)
    case 'avg': return a.orders.size ? a.revenue / a.orders.size : 0
  }
}
const fmtMeasure = (v: number, m: MeasureId) => (IS_MONEY(m) ? formatTenge(v) : String(+v.toFixed(m === 'qty' ? 2 : 0)))

// родитель раньше ребёнка (короткий префикс первым), братья — по значению (числа/строки)
const cmpPath = (a: string[], b: string[]) => {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { const c = a[i].localeCompare(b[i], 'ru', { numeric: true }); if (c) return c }
  return a.length - b.length
}

// ── сохранённые отчёты (конфиг представления — храним отдельным ключом) ──
interface SavedReport { id: string; name: string; rows: DimId[]; cols: DimId[]; measures: MeasureId[]; filters: Record<string, string[]> }
const REPORTS_KEY = 'iiko-olap-reports'
const loadReports = (): SavedReport[] => {
  try { const raw = localStorage.getItem(REPORTS_KEY); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return []
}
const saveReports = (list: SavedReport[]) => { try { localStorage.setItem(REPORTS_KEY, JSON.stringify(list)) } catch { /* ignore */ } }

export default function OfficeOlap() {
  const { closedOrders, ingredients, techCardOverrides } = usePos()

  const [rows, setRows] = useState<DimId[]>(['group', 'dish'])
  const [cols, setCols] = useState<DimId[]>(['orderType'])
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [measures, setMeasures] = useState<MeasureId[]>(['revenue', 'checks', 'qty'])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<DimId | null>(null)
  const [openFilter, setOpenFilter] = useState<DimId | null>(null)
  const [savedList, setSavedList] = useState<SavedReport[]>(loadReports)
  const [reportName, setReportName] = useState('')

  // ── факты из закрытых чеков (грейн = строка чека) ──
  const facts = useMemo<Fact[]>(() => {
    const hallName = (id: string | null) => halls.find((h) => h.id === id)?.name ?? '—'
    const out: Fact[] = []
    for (const o of closedOrders) {
      const day = (o.paidAt.split(',')[0] ?? o.paidAt).trim()
      const hh = (o.paidAt.split(',')[1] ?? '').trim().slice(0, 2)
      const hour = hh ? `${hh}:00` : '—'
      const primary = [...o.payments].sort((a, b) => b.amount - a.amount)[0]?.name ?? '—'
      const otype = ORDER_TYPE_LABEL[o.type] ?? o.type
      const hall = hallName(o.hallId)
      for (const l of o.lines) {
        const rev = lineTotal(l)
        out.push({
          orderId: o.id, day, hour, waiter: o.waiter || '—', orderType: otype, payment: primary, hall,
          dish: l.name, group: menuGroups.find((g) => g.id === findDish(l.dishId)?.groupId)?.name ?? '—',
          revenue: rev, revenueNoVat: +(rev / (1 + l.vat / 100)).toFixed(2),
          qty: l.qty, cost: +(dishCost(l.dishId, ingredients, techCardOverrides) * l.qty).toFixed(2),
        })
      }
    }
    return out
  }, [closedOrders, ingredients, techCardOverrides])

  const dimValue = (f: Fact, d: DimId) => f[d]
  const filtered = useMemo(
    () => facts.filter((f) => Object.entries(filters).every(([d, vals]) => !vals.length || vals.includes(dimValue(f, d as DimId)))),
    [facts, filters],
  )

  // distinct значения измерения (для панели фильтров)
  const distinctValues = (d: DimId) => [...new Set(facts.map((f) => dimValue(f, d)))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }))

  // distinct комбинации (полная глубина) по набору измерений
  const collectPaths = (dims: DimId[]): string[][] => {
    if (!dims.length) return [[]]
    const map = new Map<string, string[]>()
    for (const f of filtered) { const p = dims.map((d) => dimValue(f, d)); map.set(p.join(SEP), p) }
    return [...map.values()].sort(cmpPath)
  }

  const colLeaves = useMemo(() => collectPaths(cols), [filtered, cols])
  const rowLeaves = useMemo(() => collectPaths(rows), [filtered, rows])

  // pre-order дерево строк (каждый префикс = узел; листья = полная глубина)
  const rowNodes = useMemo(() => {
    if (!rows.length) return [] as { path: string[]; depth: number; leaf: boolean }[]
    const seen = new Set<string>(); const nodes: { path: string[]; depth: number; leaf: boolean }[] = []
    for (const leaf of rowLeaves) {
      for (let d = 1; d <= leaf.length; d++) {
        const pre = leaf.slice(0, d); const k = pre.join(SEP)
        if (!seen.has(k)) { seen.add(k); nodes.push({ path: pre, depth: d - 1, leaf: d === rows.length }) }
      }
    }
    return nodes.sort((a, b) => cmpPath(a.path, b.path))
  }, [rowLeaves, rows])

  const cell = (rowPath: string[], colPath: string[]): Acc => {
    const acc = emptyAcc()
    for (const f of filtered) {
      let ok = true
      for (let i = 0; i < rowPath.length; i++) if (dimValue(f, rows[i]) !== rowPath[i]) { ok = false; break }
      if (ok) for (let i = 0; i < colPath.length; i++) if (dimValue(f, cols[i]) !== colPath[i]) { ok = false; break }
      if (!ok) continue
      acc.revenue += f.revenue; acc.revenueNoVat += f.revenueNoVat; acc.qty += f.qty; acc.cost += f.cost; acc.orders.add(f.orderId)
    }
    return acc
  }

  const isHidden = (path: string[]) => {
    for (let d = 1; d < path.length; d++) if (collapsed.has(path.slice(0, d).join(SEP))) return true
    return false
  }
  const toggleCollapse = (key: string) => setCollapsed((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  // колонки данных: листья колонок (+ «Итого» если есть колоночные измерения)
  const dataCols: { path: string[]; total?: boolean }[] = cols.length
    ? [...colLeaves.map((p) => ({ path: p })), { path: [], total: true }]
    : [{ path: [] }]
  const headerRowCount = cols.length + 1 // уровни колонок + строка показателей

  // храним порядок фильтр-измерений отдельно (filters содержит только выбранные значения)
  const [filterDims, setFilterDims] = useState<DimId[]>([])

  const moveTo = (d: DimId, zone: Zone) => {
    setRows((r) => r.filter((x) => x !== d)); setCols((c) => c.filter((x) => x !== d))
    setFilterDims((fd) => fd.filter((x) => x !== d))
    setFilters((f) => { const n = { ...f }; delete n[d]; return n })
    if (zone === 'rows') setRows((r) => [...r, d])
    else if (zone === 'cols') setCols((c) => [...c, d])
    else if (zone === 'filters') { setFilterDims((fd) => [...fd, d]); setFilters((f) => ({ ...f, [d]: [] })) }
    setCollapsed(new Set())
  }
  const onDrop = (zone: Zone) => { if (drag) moveTo(drag, zone); setDrag(null) }

  const availDims = ALL_DIMS.filter((d) => !rows.includes(d) && !cols.includes(d) && !filterDims.includes(d))

  const toggleMeasure = (m: MeasureId) => setMeasures((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]))
  const toggleFilterValue = (d: DimId, v: string) => setFilters((f) => {
    const cur = f[d] ?? []; const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    return { ...f, [d]: next }
  })

  // ── сохранённые отчёты ──
  const applyReport = (r: SavedReport) => {
    setRows(r.rows); setCols(r.cols); setMeasures(r.measures)
    setFilters(r.filters); setFilterDims(Object.keys(r.filters) as DimId[]); setCollapsed(new Set())
  }
  const saveCurrent = () => {
    const name = reportName.trim(); if (!name) return
    const rep: SavedReport = { id: 'r' + (savedList.length + 1) + '-' + name.length, name, rows, cols, measures, filters }
    const list = [...savedList.filter((x) => x.name !== name), rep]
    setSavedList(list); saveReports(list); setReportName('')
  }
  const deleteReport = (id: string) => { const list = savedList.filter((x) => x.id !== id); setSavedList(list); saveReports(list) }

  // экспорт текущей сводной в Excel (видимые строки × колонки данных × показатели)
  const exportExcel = () => {
    if (!measures.length) return
    const colLabel = (dc: { path: string[]; total?: boolean }) => dc.total ? 'Итого' : (dc.path.join(' / ') || 'Все')
    const header = [rows.map((d) => DIM_LABEL[d]).join(' / ') || '—',
      ...dataCols.flatMap((dc) => measures.map((m) => `${colLabel(dc)} · ${MEASURE_LABEL(m)}`))]
    const body = (rows.length === 0 ? [{ path: [] as string[], leaf: true, depth: 0 }] : rowNodes.filter((n) => !isHidden(n.path)))
      .map((n) => [n.path.length ? n.path[n.path.length - 1] : 'Итого',
        ...dataCols.flatMap((dc) => { const a = cell(n.path, dc.path); return measures.map((m) => xlsNum(measureVal(a, m), m === 'qty' ? 2 : 0)) })])
    const totalRow = ['Итого', ...dataCols.flatMap((dc) => { const a = cell([], dc.path); return measures.map((m) => xlsNum(measureVal(a, m), m === 'qty' ? 2 : 0)) })]
    downloadExcel('iiko-OLAP', [header, ...body, ...(rows.length ? [totalRow] : [])])
  }

  const Chip = ({ d, removable }: { d: DimId; removable?: boolean }) => (
    <div draggable onDragStart={() => setDrag(d)} onDragEnd={() => setDrag(null)}
      className="inline-flex items-center gap-1 h-7 pl-1.5 pr-1 rounded bg-white border border-gray-300 text-xs text-gray-700 cursor-grab active:cursor-grabbing select-none">
      <GripVertical size={12} className="text-gray-300" />{DIM_LABEL[d]}
      {removable && <button onClick={() => moveTo(d, 'avail')} className="text-gray-400 hover:text-red-500"><X size={12} /></button>}
    </div>
  )
  const DropZone = ({ zone, label, items }: { zone: Zone; label: string; items: DimId[] }) => (
    <div onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(zone)}
      className={`min-h-[44px] rounded-md border-2 border-dashed p-1.5 flex flex-wrap items-center gap-1.5 transition-colors ${drag ? 'border-emerald-400 bg-emerald-50/40' : 'border-gray-200 bg-gray-50'}`}>
      <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-1">{label}</span>
      {items.length === 0 && <span className="text-xs text-gray-300">перетащите сюда</span>}
      {items.map((d) => <Chip key={d} d={d} removable />)}
    </div>
  )

  return (
    <div>
      <div className="text-xs text-gray-500 mb-3">
        Сводная таблица (OLAP) по закрытым чекам. Перетаскивайте измерения в зоны <b>Строки / Колонки / Фильтры</b>, выбирайте
        показатели в «Данные». Грейн — строка чека; многооплатные чеки относятся к основному типу оплаты.
      </div>

      {/* зоны конструктора */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <DropZone zone="rows" label="Строки" items={rows} />
        <DropZone zone="cols" label="Колонки" items={cols} />
        <DropZone zone="filters" label="Фильтры" items={filterDims} />
        <DropZone zone="avail" label="Доступные" items={availDims} />
      </div>

      {/* данные (показатели) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-1">Данные</span>
        {MEASURES.map((m) => (
          <button key={m.id} onClick={() => toggleMeasure(m.id)}
            className={`h-7 px-2.5 rounded text-xs border ${measures.includes(m.id) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-300'}`}>{m.label}</button>
        ))}
      </div>

      {/* активные фильтры — выбор значений */}
      {filterDims.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filterDims.map((d) => {
            const sel = filters[d] ?? []
            return (
              <div key={d} className="relative">
                <button onClick={() => setOpenFilter(openFilter === d ? null : d)}
                  className="h-7 px-2.5 rounded border border-gray-300 bg-white text-xs text-gray-700 flex items-center gap-1">
                  {DIM_LABEL[d]}: <b>{sel.length ? `${sel.length} выбр.` : 'все'}</b>
                  {openFilter === d ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {openFilter === d && (
                  <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg p-1.5">
                    <button onClick={() => setFilters((f) => ({ ...f, [d]: [] }))} className="w-full text-left text-xs text-emerald-600 px-1.5 py-1 hover:bg-gray-50 rounded">Сбросить (все)</button>
                    {distinctValues(d).map((v) => (
                      <label key={v} className="flex items-center gap-2 text-xs px-1.5 py-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={sel.includes(v)} onChange={() => toggleFilterValue(d, v)} />
                        <span className="truncate">{v}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* сохранённые отчёты */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="Название отчёта"
          className="h-8 w-44 rounded border border-gray-300 px-2 text-sm" />
        <button onClick={saveCurrent} disabled={!reportName.trim()} className="h-8 px-3 rounded bg-slate-700 text-white text-xs flex items-center gap-1 disabled:opacity-40"><Save size={14} />Сохранить</button>
        <button onClick={exportExcel} disabled={!measures.length} className="h-8 px-3 rounded bg-emerald-600 text-white text-xs disabled:opacity-40">Excel…</button>
        {savedList.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded border border-gray-300 bg-white text-xs">
            <button onClick={() => applyReport(r)} className="text-gray-700 hover:text-emerald-600">{r.name}</button>
            <button onClick={() => deleteReport(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
          </span>
        ))}
      </div>

      {/* сводная таблица */}
      {measures.length === 0 ? (
        <div className="p-4 text-sm text-gray-400 bg-white border border-gray-200 rounded-md">Выберите хотя бы один показатель в «Данные».</div>
      ) : rowNodes.length === 0 && rows.length > 0 ? (
        <div className="p-4 text-sm text-gray-400 bg-white border border-gray-200 rounded-md">Нет данных по выбранным фильтрам.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-auto">
          <table className="text-sm border-collapse min-w-full">
            <thead className="bg-gray-50">
              {/* уровни заголовков колонок */}
              {cols.map((cd, lev) => {
                // сгруппировать листья колонок по префиксу длины lev+1
                const groups: { label: string; span: number }[] = []
                let prevKey = ''
                for (const p of colLeaves) {
                  const key = p.slice(0, lev + 1).join(SEP)
                  if (key === prevKey && groups.length) groups[groups.length - 1].span += measures.length
                  else { groups.push({ label: p[lev], span: measures.length }); prevKey = key }
                }
                return (
                  <tr key={cd}>
                    {lev === 0 && <th rowSpan={headerRowCount} className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-1.5 border border-gray-200 text-gray-500 align-bottom min-w-[200px]">{rows.map((d) => DIM_LABEL[d]).join(' / ') || '—'}</th>}
                    {groups.map((g, i) => <th key={i} colSpan={g.span} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-center">{g.label}</th>)}
                    {lev === 0 && <th colSpan={measures.length} rowSpan={cols.length} className="px-3 py-1.5 border border-gray-200 text-gray-700 text-center bg-gray-100">Итого</th>}
                  </tr>
                )
              })}
              {/* строка показателей под каждой колонкой данных */}
              <tr>
                {cols.length === 0 && <th rowSpan={1} className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-1.5 border border-gray-200 text-gray-500 min-w-[200px]">{rows.map((d) => DIM_LABEL[d]).join(' / ') || '—'}</th>}
                {dataCols.map((dc, ci) => measures.map((m) => (
                  <th key={ci + '-' + m} className={`px-3 py-1.5 border border-gray-200 text-right text-gray-500 font-medium whitespace-nowrap ${dc.total ? 'bg-gray-100' : ''}`}>{MEASURE_LABEL(m)}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border border-gray-200 font-medium">Итого</td>
                  {dataCols.map((dc, ci) => { const a = cell([], dc.path); return measures.map((m) => (
                    <td key={ci + '-' + m} className={`px-3 py-1.5 border border-gray-200 text-right tabular-nums ${dc.total ? 'bg-gray-50 font-medium' : ''}`}>{fmtMeasure(measureVal(a, m), m)}</td>
                  )) })}
                </tr>
              ) : rowNodes.filter((n) => !isHidden(n.path)).map((n) => {
                const key = n.path.join(SEP); const isCollapsed = collapsed.has(key)
                return (
                  <tr key={key} className={n.leaf ? 'hover:bg-gray-50' : 'bg-gray-50/60 font-medium'}>
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 border border-gray-200 whitespace-nowrap" style={{ paddingLeft: 12 + n.depth * 18 }}>
                      {!n.leaf && (
                        <button onClick={() => toggleCollapse(key)} className="align-middle mr-1 text-gray-400 hover:text-gray-700">
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      {n.path[n.path.length - 1]}
                    </td>
                    {dataCols.map((dc, ci) => { const a = cell(n.path, dc.path); return measures.map((m) => (
                      <td key={ci + '-' + m} className={`px-3 py-1.5 border border-gray-200 text-right tabular-nums ${dc.total ? 'bg-gray-50' : ''}`}>{fmtMeasure(measureVal(a, m), m)}</td>
                    )) })}
                  </tr>
                )
              })}
              {/* итоговая строка */}
              {rows.length > 0 && (
                <tr className="bg-gray-100 font-semibold">
                  <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5 border border-gray-200">Итого</td>
                  {dataCols.map((dc, ci) => { const a = cell([], dc.path); return measures.map((m) => (
                    <td key={ci + '-' + m} className="px-3 py-1.5 border border-gray-200 text-right tabular-nums">{fmtMeasure(measureVal(a, m), m)}</td>
                  )) })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-xs text-gray-400 mt-2">
        Куб строится на лету из {facts.length} строк продаж ({closedOrders.length} чеков). Прибыль = выручка без ҚҚС − себестоимость по техкартам.
        Сохранённые отчёты хранятся локально (<code>{REPORTS_KEY}</code>).
      </div>
    </div>
  )
}
