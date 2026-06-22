import { describe, it, expect } from 'vitest'
import { modifierCost, orderLineCost, consumptionDelta, applyWriteoff, applyRestock } from './warehouse'
import type { Ingredient, OrderLine, TechCardItem } from '../types'

// i-rice есть в modifierTechCards['mo-rice'] = [{ i-rice, gross 0.15 }]
const ings: Ingredient[] = [
  { id: 'i-meat', code: 'meat', name: 'Мясо', unit: 'кг', stock: 10, costPerUnit: 2000, min: 1 },
  { id: 'i-rice', code: 'rice', name: 'Рис', unit: 'кг', stock: 10, costPerUnit: 300, min: 1 },
]
const over: Record<string, TechCardItem[]> = { 'd-test': [{ ingredientId: 'i-meat', gross: 0.1 }] }
const line = (mods: { optionId: string; qty: number }[], qty = 1): OrderLine => ({
  uid: 'u1', dishId: 'd-test', name: 'Тест', price: 1000, vat: 16, qty,
  modifiers: mods.map((m) => ({ optionId: m.optionId, name: m.optionId, price: 0, qty: m.qty })),
})

describe('modifierCost', () => {
  it('доп-ингредиент модификатора: 0.15 кг риса × 300 = 45', () => {
    expect(modifierCost('mo-rice', ings)).toBe(45)
  })
  it('нет техкарты модификатора → 0', () => {
    expect(modifierCost('mo-unknown', ings)).toBe(0)
  })
})

describe('orderLineCost (опен-меню: доп мясо поднимает себес)', () => {
  it('без модификатора = только блюдо', () => {
    expect(orderLineCost(line([]), ings, over)).toBe(200) // 0.1×2000
  })
  it('с доп-гарниром = блюдо + модификатор', () => {
    expect(orderLineCost(line([{ optionId: 'mo-rice', qty: 1 }]), ings, over)).toBe(245) // 200 + 45
  })
  it('кол-во блюда множит и блюдо, и модификатор', () => {
    expect(orderLineCost(line([{ optionId: 'mo-rice', qty: 2 }], 3), ings, over)).toBe(870) // (200 + 45×2)×3
  })
})

describe('consumptionDelta учитывает модификатор (списание со склада)', () => {
  it('рис списывается по норме модификатора × кол-во', () => {
    const d = consumptionDelta([line([{ optionId: 'mo-rice', qty: 2 }], 3)], over)
    expect(d['i-rice']).toBeCloseTo(0.9, 4) // 0.15×2×3
    expect(d['i-meat']).toBeCloseTo(0.3, 4) // 0.1×3
  })
})

// ШАГ 0 (сеть безопасности перед рефактором под перемещения):
// списание при продаже и возврат на склад — инварианты, которые НЕ должны измениться.
describe('applyWriteoff / applyRestock — характеризация списания продажи', () => {
  const lines = [line([{ optionId: 'mo-rice', qty: 1 }], 2)] // блюдо d-test ×2 + рис
  it('applyWriteoff уменьшает остаток на consumptionDelta', () => {
    const after = applyWriteoff(ings, lines, over)
    const meat = after.find((i) => i.id === 'i-meat')!
    const rice = after.find((i) => i.id === 'i-rice')!
    expect(meat.stock).toBeCloseTo(10 - 0.2, 3) // 0.1×2
    expect(rice.stock).toBeCloseTo(10 - 0.3, 3) // 0.15×1×2
  })
  it('applyRestock — обратная операция к applyWriteoff (возврат на склад)', () => {
    const back = applyRestock(applyWriteoff(ings, lines, over), lines, over)
    for (const i of ings) expect(back.find((x) => x.id === i.id)!.stock).toBeCloseTo(i.stock, 3)
  })
})
