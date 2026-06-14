import { describe, it, expect } from 'vitest'
import { vatAmount, vatBreakdown } from './money'

// ҚҚС РК 16% включён в цену (розница): выделение налога из суммы с НДС.
describe('vatAmount (ҚҚС 16% в т.ч.)', () => {
  it('выделяет 16% из суммы с НДС', () => {
    expect(vatAmount(1160, 16)).toBeCloseTo(160, 2) // 1160 - 1160/1.16 = 160
  })
  it('ставка 0% — налога нет', () => {
    expect(vatAmount(1000, 0)).toBe(0)
  })
})

// Мультиставка: позиции с разными ставками (16% еда + 0% услуга доставки).
describe('vatBreakdown (мультиставка 16%/0%)', () => {
  it('разбивает по ставкам, сортирует по убыванию, считает net+vat', () => {
    const rows = vatBreakdown([
      { gross: 1160, rate: 16 },
      { gross: 500, rate: 0 },
      { gross: 232, rate: 16 },
    ])
    expect(rows.map((r) => r.rate)).toEqual([16, 0])
    const r16 = rows.find((r) => r.rate === 16)!
    expect(r16.gross).toBeCloseTo(1392, 2)
    expect(r16.vat).toBeCloseTo(192, 2) // 1392 - 1392/1.16
    expect(r16.net).toBeCloseTo(1200, 2)
    const r0 = rows.find((r) => r.rate === 0)!
    expect(r0.vat).toBe(0)
    expect(r0.net).toBeCloseTo(500, 2)
  })
  it('пустой ввод → пустая разбивка', () => {
    expect(vatBreakdown([])).toEqual([])
  })
})
