// ─────────────────────────────────────────────────────────────────────────────
// Чистый движок сводной таблицы (OLAP) — выделен из логики OfficeOlap, чтобы
// переиспользовать для новых отчётов (Настраиваемый 616, OLAP по проводкам) БЕЗ
// изменения рабочего «OLAP по продажам». Только агрегация фактов; UI — отдельно.
// Факт = плоский объект; измерение = строковый ключ факта; показатель = редьюсер.
// ─────────────────────────────────────────────────────────────────────────────

const SEP = String.fromCharCode(1) // разделитель ключей пути (маловероятен в данных)

export interface PivotMeasure<F> { id: string; label: string; money?: boolean; value: (facts: F[]) => number }

// значение измерения у факта (строка; пусто/undefined → «—»)
export const dimVal = (f: Record<string, unknown>, d: string): string => {
  const v = f[d]
  return v == null || v === '' ? '—' : String(v)
}

// фильтр по выбранным значениям измерений (включающий). Пустой список значений = «все».
export function filterFacts<F extends Record<string, unknown>>(facts: F[], filters?: Record<string, string[]>): F[] {
  if (!filters) return facts
  const active = Object.entries(filters).filter(([, vals]) => vals && vals.length)
  if (!active.length) return facts
  return facts.filter((f) => active.every(([d, vals]) => vals.includes(dimVal(f, d))))
}

// сравнение путей: родитель раньше ребёнка, братья — по значению (числа/строки)
export const cmpPath = (a: string[], b: string[]): number => {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { const c = a[i].localeCompare(b[i], 'ru', { numeric: true }); if (c) return c }
  return a.length - b.length
}

// уникальные комбинации значений по набору измерений (полная глубина), отсортированы
export function collectPaths<F extends Record<string, unknown>>(facts: F[], dims: string[]): string[][] {
  if (!dims.length) return [[]]
  const map = new Map<string, string[]>()
  for (const f of facts) { const p = dims.map((d) => dimVal(f, d)); map.set(p.join(SEP), p) }
  return [...map.values()].sort(cmpPath)
}

// pre-order узлы строк: каждый префикс — узел (для subtotals), листья — полная глубина
export interface RowNode { path: string[]; depth: number; leaf: boolean }
export function rowNodes<F extends Record<string, unknown>>(facts: F[], rows: string[]): RowNode[] {
  if (!rows.length) return []
  const leaves = collectPaths(facts, rows)
  const seen = new Set<string>(); const nodes: RowNode[] = []
  for (const leaf of leaves) {
    for (let d = 1; d <= leaf.length; d++) {
      const pre = leaf.slice(0, d); const k = pre.join(SEP)
      if (!seen.has(k)) { seen.add(k); nodes.push({ path: pre, depth: d - 1, leaf: d === rows.length }) }
    }
  }
  return nodes.sort((a, b) => cmpPath(a.path, b.path))
}

// факты ячейки = пересечение префиксов строк и колонок (пустой путь = без ограничения)
export function cellFacts<F extends Record<string, unknown>>(facts: F[], rows: string[], rowPath: string[], cols: string[], colPath: string[]): F[] {
  return facts.filter((f) => {
    for (let i = 0; i < rowPath.length; i++) if (dimVal(f, rows[i]) !== rowPath[i]) return false
    for (let i = 0; i < colPath.length; i++) if (dimVal(f, cols[i]) !== colPath[i]) return false
    return true
  })
}

// колонки данных: листья колонок (+ грандтотал-колонка, если есть колоночные измерения)
export function dataColumns<F extends Record<string, unknown>>(facts: F[], cols: string[]): { path: string[]; total?: boolean }[] {
  if (!cols.length) return [{ path: [] }]
  return [...collectPaths(facts, cols).map((p) => ({ path: p })), { path: [] as string[], total: true }]
}
