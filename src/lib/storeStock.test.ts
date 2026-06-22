import { describe, it, expect } from 'vitest'
import { initFromIngredients, stockAt, totalOf, totalsMap, applyDelta, transfer } from './storeStock'
import type { Ingredient } from '../types'

const DEF = 'Основной склад'
const ings: Ingredient[] = [
  { id: 'i-meat', code: 'M', name: 'Мясо', unit: 'кг', stock: 10, costPerUnit: 2000, min: 1 },
  { id: 'i-beer', code: 'B', name: 'Пиво', unit: 'л', stock: 50, costPerUnit: 700, min: 5, store: 'Бар' },
]

describe('initFromIngredients', () => {
  it('весь остаток на домашнем складе (дефолт / Бар)', () => {
    const ss = initFromIngredients(ings, DEF)
    expect(stockAt(ss, 'i-meat', DEF)).toBe(10)
    expect(stockAt(ss, 'i-beer', 'Бар')).toBe(50)
    expect(stockAt(ss, 'i-beer', DEF)).toBe(0)
  })
})

describe('totalOf / totalsMap = инвариант итога', () => {
  it('итог = сумма по складам; перемещение его не меняет', () => {
    let ss = initFromIngredients(ings, DEF)
    expect(totalOf(ss, 'i-meat')).toBe(10)
    ss = transfer(ss, 'i-meat', DEF, 'Бар', 3).ss
    expect(totalOf(ss, 'i-meat')).toBe(10) // итог неизменен
    expect(totalsMap(ss)['i-meat']).toBe(10)
  })
})

describe('applyDelta', () => {
  it('иммутабелен и складывает количество', () => {
    const ss = initFromIngredients(ings, DEF)
    const next = applyDelta(ss, 'i-meat', DEF, -4)
    expect(stockAt(next, 'i-meat', DEF)).toBe(6)
    expect(stockAt(ss, 'i-meat', DEF)).toBe(10) // исходный не тронут
  })
})

describe('transfer', () => {
  it('двигает между складами, итог сохраняется', () => {
    const ss = initFromIngredients(ings, DEF)
    const r = transfer(ss, 'i-meat', DEF, 'Бар', 4)
    expect(r.ok).toBe(true)
    expect(stockAt(r.ss, 'i-meat', DEF)).toBe(6)
    expect(stockAt(r.ss, 'i-meat', 'Бар')).toBe(4)
  })
  it('нельзя отпустить больше, чем есть', () => {
    const ss = initFromIngredients(ings, DEF)
    const r = transfer(ss, 'i-meat', DEF, 'Бар', 99)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Недостаточно/)
    expect(r.ss).toBe(ss) // без изменений
  })
  it('отвергает нулевое количество и одинаковые склады', () => {
    const ss = initFromIngredients(ings, DEF)
    expect(transfer(ss, 'i-meat', DEF, 'Бар', 0).ok).toBe(false)
    expect(transfer(ss, 'i-meat', DEF, DEF, 5).ok).toBe(false)
  })
})
