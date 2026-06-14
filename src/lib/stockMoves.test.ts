import { describe, it, expect } from 'vitest'
import { buildStockMoves, reconstructOpening, turnoverByIngredient, ingredientLedger, dateSortKey } from './stockMoves'
import type { Ingredient, Invoice, StoreDoc, ClosedOrder } from '../types'

const ing = (id: string, stock: number, cost = 100): Ingredient =>
  ({ id, code: id.toUpperCase(), name: id, unit: 'кг', stock, costPerUnit: cost, min: 0 })

const invoiceIn = (lines: { ingredientId: string; qty: number; price?: number }[], date = '2026-06-14'): Invoice =>
  ({ id: 1, no: 'ПН-1', date, supplierName: 'ТОО Поставщик', supplierBin: '000', total: 0, vat: 0, esfNo: 'ESF', kind: 'in', store: 'Основной склад',
     lines: lines.map((l) => ({ ingredientId: l.ingredientId, name: l.ingredientId, qty: l.qty, price: l.price ?? 100 })) })

describe('dateSortKey — хронологическая сортировка смешанных форматов', () => {
  it('часы/минуты внутри дня', () => {
    expect(dateSortKey('14.06.2026, 09:30') < dateSortKey('14.06.2026, 10:00')).toBe(true)
  })
  it('ISO и dd.mm.yyyy сопоставимы между собой', () => {
    expect(dateSortKey('2026-06-13') < dateSortKey('14.06.2026')).toBe(true)
    expect(dateSortKey('05.01.2026') < dateSortKey('05.02.2026')).toBe(true)
  })
})

describe('buildStockMoves + turnoverByIngredient — реконсиляция остатков', () => {
  it('инвариант: openQty + приход − расход == closeQty для каждого товара', () => {
    const ingredients = [ing('i-cola', 60, 350), ing('i-flour', 30, 300)]
    const invoices = [invoiceIn([{ ingredientId: 'i-cola', qty: 10 }, { ingredientId: 'i-flour', qty: 5 }])]
    const documents: StoreDoc[] = [{ id: 1, type: 'Акт списания', at: '14.06.2026, 12:00', by: 'Петров', store: 'Основной склад', lines: [{ ingredientId: 'i-cola', name: 'cola', unit: 'шт', qty: 3 }] }]
    const moves = buildStockMoves({ invoices, documents, closedOrders: [], ingredients })
    const turn = turnoverByIngredient(moves, ingredients)
    for (const t of turn) expect(+(t.openQty + t.inQty - t.outQty).toFixed(3)).toBeCloseTo(t.closeQty, 3)
    const cola = turn.find((t) => t.ingredientId === 'i-cola')!
    expect(cola.inQty).toBe(10)
    expect(cola.outQty).toBe(3)
    expect(cola.openQty).toBe(53)   // 60 − 10 + 3
    expect(cola.closeQty).toBe(60)
  })
})

describe('buildStockMoves — инвентаризация даёт движение на расхождение', () => {
  it('факт 58 при учётном 60 → расход 2', () => {
    const documents: StoreDoc[] = [{ id: 2, type: 'Инвентаризация', at: '14.06.2026, 13:00', by: 'Петров', store: 'Основной склад', lines: [{ ingredientId: 'i-cola', name: 'cola', unit: 'шт', qty: 58, booked: 60 }] }]
    const moves = buildStockMoves({ invoices: [], documents, closedOrders: [], ingredients: [ing('i-cola', 58, 350)] })
    expect(moves).toHaveLength(1)
    expect(moves[0].docType).toBe('Инвентаризация')
    expect(moves[0].outQty).toBe(2)
    expect(moves[0].inQty).toBe(0)
  })
})

describe('buildStockMoves — расход по продажам через реальную техкарту', () => {
  it('продажа d-cola ×2 списывает i-cola 2 (Реализация)', () => {
    const order = { id: 184, paidAt: '14.06.2026, 19:05',
      lines: [{ uid: 'l1', dishId: 'd-cola', name: 'Кола', price: 600, vat: 16, qty: 2, modifiers: [] }] } as unknown as ClosedOrder
    const moves = buildStockMoves({ invoices: [], documents: [], closedOrders: [order], ingredients: [ing('i-cola', 60, 350)] })
    const sale = moves.find((m) => m.docType === 'Реализация')!
    expect(sale).toBeTruthy()
    expect(sale.ingredientId).toBe('i-cola')
    expect(sale.outQty).toBe(2)
    expect(sale.corr).toContain('Чек №184')
  })
})

describe('ingredientLedger — накопительный остаток по операциям', () => {
  it('приход и расход дают корректный running-баланс', () => {
    const ingredients = [ing('i-cola', 60, 350)]
    const invoices = [invoiceIn([{ ingredientId: 'i-cola', qty: 10 }])]
    const documents: StoreDoc[] = [{ id: 1, type: 'Акт списания', at: '14.06.2026, 12:00', by: 'Петров', store: 'Основной склад', lines: [{ ingredientId: 'i-cola', name: 'cola', unit: 'шт', qty: 3 }] }]
    const moves = buildStockMoves({ invoices, documents, closedOrders: [], ingredients })
    const opening = reconstructOpening(moves, ingredients)
    expect(opening['i-cola']).toBe(53)
    const led = ingredientLedger(moves, opening, 'i-cola')
    expect(led).toHaveLength(2)
    expect(led[0].balance).toBe(63) // +10 приход (накладная 00:00)
    expect(led[1].balance).toBe(60) // −3 списание (12:00)
  })
})
