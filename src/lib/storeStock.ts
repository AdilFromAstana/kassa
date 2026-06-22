import type { Ingredient } from '../types'

// Единый источник правды по складам (модуль «Перемещения», TRANSFER_PLAN.md).
// StoreStock: ingredientId → склад → количество. Итог по ингредиенту = сумма по складам.
// Соответствует StockBalance по точке в .NET-бэке (фронт↔бэк консистентны).
// Чистые иммутабельные функции — в стор подключаются на Шаге 2.

export type StoreStock = Record<string, Record<string, number>>

const r3 = (n: number) => +n.toFixed(3)

// Инициализация из плоских остатков: весь остаток ингредиента кладётся на его «домашний» склад.
export function initFromIngredients(ings: Ingredient[], defaultStore: string): StoreStock {
  const ss: StoreStock = {}
  for (const i of ings) ss[i.id] = { [i.store ?? defaultStore]: r3(i.stock) }
  return ss
}

// Остаток ингредиента на конкретном складе (0, если нет записи).
export function stockAt(ss: StoreStock, id: string, store: string): number {
  return ss[id]?.[store] ?? 0
}

// Итог по ингредиенту = сумма по всем складам.
export function totalOf(ss: StoreStock, id: string): number {
  const byStore = ss[id]
  if (!byStore) return 0
  return r3(Object.values(byStore).reduce((s, q) => s + q, 0))
}

// Итоги по всем ингредиентам (id → итог) — для ресинка кэша Ingredient.stock.
export function totalsMap(ss: StoreStock): Record<string, number> {
  const m: Record<string, number> = {}
  for (const id of Object.keys(ss)) m[id] = totalOf(ss, id)
  return m
}

// Иммутабельное изменение остатка на складе (qty со знаком). Единственная точка мутации.
export function applyDelta(ss: StoreStock, id: string, store: string, qty: number): StoreStock {
  const byStore = { ...(ss[id] ?? {}) }
  byStore[store] = r3((byStore[store] ?? 0) + qty)
  return { ...ss, [id]: byStore }
}

export interface TransferResult { ok: boolean; ss: StoreStock; error?: string }

// Перемещение qty единиц ингредиента from → to. Итог по ингредиенту НЕ меняется.
// Валидация: qty > 0, склады разные, на источнике достаточно остатка.
export function transfer(ss: StoreStock, id: string, from: string, to: string, qty: number): TransferResult {
  if (qty <= 0) return { ok: false, ss, error: 'Количество должно быть больше нуля' }
  if (from === to) return { ok: false, ss, error: 'Склад-источник и приёмник совпадают' }
  if (stockAt(ss, id, from) < qty) return { ok: false, ss, error: `Недостаточно на складе «${from}» (есть ${stockAt(ss, id, from)})` }
  return { ok: true, ss: applyDelta(applyDelta(ss, id, from, -qty), id, to, qty) }
}
