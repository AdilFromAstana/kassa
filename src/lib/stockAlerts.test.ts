import { describe, it, expect } from 'vitest'
import { lowStock } from './stockAlerts'
import type { Ingredient } from '../types'

const ing = (id: string, stock: number, min: number): Ingredient =>
  ({ id, code: id, name: id, unit: 'кг', stock, costPerUnit: 100, min })

describe('lowStock', () => {
  it('пустой склад — нет тревог', () => {
    const r = lowStock([])
    expect(r.count).toBe(0)
    expect(r.severity).toBe('none')
  })

  it('остаток выше минимума — норма', () => {
    const r = lowStock([ing('a', 10, 3)])
    expect(r.count).toBe(0)
    expect(r.severity).toBe('none')
  })

  it('остаток == min — заканчивается (граница включительно)', () => {
    const r = lowStock([ing('a', 3, 3)])
    expect(r.low.map((i) => i.id)).toEqual(['a'])
    expect(r.out).toEqual([])
    expect(r.severity).toBe('low')
  })

  it('остаток 0 и отрицательный — закончился', () => {
    const r = lowStock([ing('a', 0, 3), ing('b', -2, 3)])
    expect(r.out.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.severity).toBe('out')
  })

  it('out имеет приоритет severity над low; count = out+low', () => {
    const r = lowStock([ing('a', 0, 3), ing('b', 2, 3), ing('c', 9, 3)])
    expect(r.count).toBe(2)
    expect(r.severity).toBe('out')
  })
})
