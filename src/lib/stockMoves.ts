import type { Ingredient, Invoice, StoreDoc, ClosedOrder, TechCardItem } from '../types'
import { consumptionDelta } from '../mock/warehouse'

// ─────────────────────────────────────────────────────────────────────────────
// Единый журнал складских движений — фундамент товарных отчётов (iiko «Движение
// товара» 606, «Товарный отчёт» 615, расш. ОСВ 605). В моке нет хранимого журнала
// движений и начального остатка, поэтому собираем операции из:
//   • приходных накладных (invoices, kind=in) — приход;
//   • складских документов (documents) — расход / инвентаризация (по расхождению);
//   • продаж (closedOrders × техкарты) — расход «Реализация».
// и РЕКОНСТРУИРУЕМ начальный остаток: opening = current − Σприход + Σрасход.
// Оценка по текущей себестоимости (costPerUnit) — мок-упрощение (iiko: скользящая).
// Один склад на ингредиент (перемещение уменьшает общий остаток) — мок-упрощение.
// ─────────────────────────────────────────────────────────────────────────────

export interface StockMove {
  at: string          // отображаемая дата/время документа
  sortKey: string     // нормализованный ключ хронологической сортировки
  docType: string     // 'Приходная накладная' | 'Акт списания' | … | 'Реализация' | 'Инвентаризация'
  docNo: string
  ingredientId: string
  inQty: number       // приход (кол-во)
  outQty: number      // расход (кол-во)
  store: string
  corr: string        // корреспонденция: поставщик / блюдо / причина / склад-получатель
  costPerUnit: number
}

const r3 = (n: number) => +n.toFixed(3)

// Нормализация даты в сортируемый ключ. Поддержка 'dd.mm.yyyy[, hh:mm[:ss]]' и ISO 'yyyy-mm-dd'.
export function dateSortKey(s: string): string {
  const m = /(\d{2})\.(\d{2})\.(\d{4})(?:,?\s*(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s)
  if (m) return `${m[3]}${m[2]}${m[1]}${m[4] ?? '00'}${m[5] ?? '00'}${m[6] ?? '00'}`
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}000000`
  return s
}

export function buildStockMoves(args: {
  invoices: Invoice[]
  documents: StoreDoc[]
  closedOrders: ClosedOrder[]
  ingredients: Ingredient[]
  techCardOverrides?: Record<string, TechCardItem[]>
}): StockMove[] {
  const { invoices, documents, closedOrders, ingredients, techCardOverrides } = args
  const costOf = (id: string) => ingredients.find((i) => i.id === id)?.costPerUnit ?? 0
  const moves: StockMove[] = []

  // приход — входящие накладные
  for (const inv of invoices) {
    if (inv.kind === 'out') continue
    for (const l of inv.lines) {
      moves.push({ at: inv.date, sortKey: dateSortKey(inv.date), docType: 'Приходная накладная', docNo: inv.no, ingredientId: l.ingredientId, inQty: r3(l.qty), outQty: 0, store: inv.store ?? 'Основной склад', corr: inv.supplierName, costPerUnit: costOf(l.ingredientId) })
    }
  }

  // складские документы — расход; инвентаризация даёт движение только на величину расхождения
  for (const d of documents) {
    for (const l of d.lines) {
      if (d.type === 'Инвентаризация') {
        const delta = r3(l.qty - (l.booked ?? 0)) // факт − учётный
        if (delta === 0) continue
        moves.push({ at: d.at, sortKey: dateSortKey(d.at), docType: 'Инвентаризация', docNo: `№${d.id}`, ingredientId: l.ingredientId, inQty: delta > 0 ? delta : 0, outQty: delta < 0 ? -delta : 0, store: d.store, corr: 'Инвентаризация (расхождение)', costPerUnit: costOf(l.ingredientId) })
      } else {
        const corr = d.reason ?? d.result ?? (d.toStore ? `→ ${d.toStore}` : d.type)
        moves.push({ at: d.at, sortKey: dateSortKey(d.at), docType: d.type, docNo: `№${d.id}`, ingredientId: l.ingredientId, inQty: 0, outQty: r3(l.qty), store: d.store, corr, costPerUnit: costOf(l.ingredientId) })
      }
    }
  }

  // расход по продажам — реализация по техкартам (аналог Акта реализации)
  for (const o of closedOrders) {
    const delta = consumptionDelta(o.lines, techCardOverrides)
    for (const [ingredientId, qty] of Object.entries(delta)) {
      if (qty === 0) continue
      // qty<0 (напр. возврат обычного молока при альт. модификаторе) → приход
      moves.push({ at: o.paidAt, sortKey: dateSortKey(o.paidAt), docType: 'Реализация', docNo: `Чек №${o.id}`, ingredientId, inQty: qty < 0 ? r3(-qty) : 0, outQty: qty > 0 ? r3(qty) : 0, store: 'Основной склад', corr: `Чек №${o.id}`, costPerUnit: costOf(ingredientId) })
    }
  }

  return moves.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

// Реконструкция начального остатка: current = opening + Σприход − Σрасход → opening = current − Σприход + Σрасход.
export function reconstructOpening(moves: StockMove[], ingredients: Ingredient[]): Record<string, number> {
  const opening: Record<string, number> = {}
  for (const i of ingredients) opening[i.id] = i.stock
  for (const m of moves) opening[m.ingredientId] = r3((opening[m.ingredientId] ?? 0) - m.inQty + m.outQty)
  return opening
}

export interface Turnover {
  ingredientId: string; name: string; unit: string; costPerUnit: number
  openQty: number; inQty: number; outQty: number; closeQty: number
}

// Обороты по каждому ингредиенту (расш. ОСВ 605): нач.остаток / приход / расход / кон.остаток.
// Инвариант: openQty + inQty − outQty == closeQty (== текущий stock).
export function turnoverByIngredient(moves: StockMove[], ingredients: Ingredient[]): Turnover[] {
  const opening = reconstructOpening(moves, ingredients)
  return ingredients.map((i) => {
    const ms = moves.filter((m) => m.ingredientId === i.id)
    return {
      ingredientId: i.id, name: i.name, unit: i.unit, costPerUnit: i.costPerUnit,
      openQty: opening[i.id] ?? 0,
      inQty: r3(ms.reduce((s, m) => s + m.inQty, 0)),
      outQty: r3(ms.reduce((s, m) => s + m.outQty, 0)),
      closeQty: i.stock,
    }
  })
}

// Лента операций по одному товару с накопительным остатком (Движение товара 606).
export function ingredientLedger(moves: StockMove[], opening: Record<string, number>, ingredientId: string): Array<StockMove & { balance: number }> {
  let bal = opening[ingredientId] ?? 0
  return moves.filter((m) => m.ingredientId === ingredientId).map((m) => {
    bal = r3(bal + m.inQty - m.outQty)
    return { ...m, balance: bal }
  })
}
