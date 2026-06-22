import type { Ingredient } from '../types'

// Низкий остаток склада (модуль «уведомление когда закончились товары»).
// Единый источник для WarehouseScreen, индикатора в TopBar и будущего Telegram-хаба.
//  out  — закончился (остаток ≤ 0): продавать нечем.
//  low  — заканчивается (0 < остаток ≤ min): пора заказывать.
// Порог берётся из Ingredient.min (минимальный остаток).

export interface StockAlerts {
  out: Ingredient[]
  low: Ingredient[]
  count: number          // out + low
  severity: 'none' | 'low' | 'out'
}

export function lowStock(ingredients: Ingredient[]): StockAlerts {
  const out: Ingredient[] = []
  const low: Ingredient[] = []
  for (const i of ingredients) {
    if (i.stock <= 0) out.push(i)
    else if (i.stock <= i.min) low.push(i)
  }
  return {
    out,
    low,
    count: out.length + low.length,
    severity: out.length > 0 ? 'out' : low.length > 0 ? 'low' : 'none',
  }
}
