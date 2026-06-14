import { describe, it, expect } from 'vitest'
import { collectPaths, rowNodes, cellFacts, filterFacts, dataColumns, dimVal, type PivotMeasure } from './pivot'

interface F extends Record<string, unknown> { type: string; pay: string; rev: number }
const facts: F[] = [
  { type: 'Зал', pay: 'Наличные', rev: 100 },
  { type: 'Зал', pay: 'Карта', rev: 200 },
  { type: 'Вынос', pay: 'Наличные', rev: 50 },
]
const revM: PivotMeasure<F> = { id: 'rev', label: 'Выручка', money: true, value: (fs) => fs.reduce((s, f) => s + f.rev, 0) }
const cntM: PivotMeasure<F> = { id: 'cnt', label: 'Кол-во', value: (fs) => fs.length }

describe('dimVal', () => {
  it('пусто/undefined → «—»', () => {
    expect(dimVal({ a: '' }, 'a')).toBe('—')
    expect(dimVal({}, 'a')).toBe('—')
    expect(dimVal({ a: 'Зал' }, 'a')).toBe('Зал')
  })
})

describe('collectPaths', () => {
  it('уникальные значения измерения, отсортированы', () => {
    expect(collectPaths(facts, ['type'])).toEqual([['Вынос'], ['Зал']])
  })
  it('пустой набор измерений → один пустой путь', () => {
    expect(collectPaths(facts, [])).toEqual([[]])
  })
})

describe('rowNodes — дерево строк с узлами-субитогами', () => {
  it('двухуровневая группировка даёт узлы-родители и листья', () => {
    const nodes = rowNodes(facts, ['type', 'pay'])
    // Вынос(родитель), Вынос/Наличные(лист), Зал(родитель), Зал/Карта, Зал/Наличные
    expect(nodes).toHaveLength(5)
    const parent = nodes.find((n) => n.path.length === 1 && n.path[0] === 'Зал')!
    expect(parent.leaf).toBe(false)
    expect(parent.depth).toBe(0)
    const leaf = nodes.find((n) => n.path.join('/') === 'Зал/Карта')!
    expect(leaf.leaf).toBe(true)
    expect(leaf.depth).toBe(1)
  })
})

describe('cellFacts + measure', () => {
  it('ячейка по префиксу строки агрегирует только свои факты', () => {
    const zal = cellFacts(facts, ['type'], ['Зал'], [], [])
    expect(revM.value(zal)).toBe(300)
    expect(cntM.value(zal)).toBe(2)
  })
  it('грандтотал (пустые пути) = все факты', () => {
    const all = cellFacts(facts, ['type'], [], [], [])
    expect(revM.value(all)).toBe(350)
    expect(cntM.value(all)).toBe(3)
  })
  it('пересечение строка×колонка', () => {
    const cell = cellFacts(facts, ['type'], ['Зал'], ['pay'], ['Наличные'])
    expect(revM.value(cell)).toBe(100)
  })
})

describe('filterFacts', () => {
  it('включающий фильтр по значению измерения', () => {
    expect(filterFacts(facts, { pay: ['Наличные'] }).map((f) => f.rev)).toEqual([100, 50])
  })
  it('пустой список значений = все', () => {
    expect(filterFacts(facts, { pay: [] })).toHaveLength(3)
  })
})

describe('dataColumns', () => {
  it('без колоночных измерений — одна колонка', () => {
    expect(dataColumns(facts, [])).toEqual([{ path: [] }])
  })
  it('с измерением — листья + грандтотал-колонка', () => {
    const cols = dataColumns(facts, ['pay'])
    expect(cols[cols.length - 1].total).toBe(true)
    expect(cols.filter((c) => !c.total).map((c) => c.path[0])).toEqual(['Карта', 'Наличные'])
  })
})

describe('грандтотал = сумма ячеек', () => {
  it('сумма выручки по листьям строк равна гранд-тоталу', () => {
    const leaves = collectPaths(facts, ['type'])
    const sum = leaves.reduce((s, p) => s + revM.value(cellFacts(facts, ['type'], p, [], [])), 0)
    expect(sum).toBe(revM.value(facts))
  })
})
