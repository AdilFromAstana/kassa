import type { Ingredient, TechCardItem, OrderLine } from '../types'

// Складская модель iiko (iikoOperation), упрощённая, но по официальной схеме:
//  • на складе лежат ТОВАРЫ-ингредиенты с остатком и себестоимостью за ед. (не готовые блюда);
//  • у блюда есть ТЕХКАРТА (ТТК) — норма закладки (брутто) ингредиентов на 1 порцию;
//  • при продаже списываются ингредиенты по техкарте → остаток падает (аналог «Акта реализации»);
//  • себестоимость блюда = Σ (брутто × себестоимость ингредиента) — поле «*» в номенклатуре.
// См. ../../iiko_spec/04_tovary_i_sklady.md.

// ───────────────────────── Товары (склад) ─────────────────────────
export const baseIngredients: Ingredient[] = [
  // Мясо / рыба
  { id: 'i-lamb',    code: 'T1001', name: 'Баранья рулька (п/ф)', unit: 'кг', stock: 12,  costPerUnit: 9000,  min: 3 },
  { id: 'i-ribeye',  code: 'T1002', name: 'Рибай (мякоть)',       unit: 'кг', stock: 10,  costPerUnit: 12000, min: 2 },
  { id: 'i-chicken', code: 'T1003', name: 'Филе куриное',         unit: 'кг', stock: 15,  costPerUnit: 2500,  min: 3 },
  { id: 'i-beef',    code: 'T1004', name: 'Говядина',             unit: 'кг', stock: 20,  costPerUnit: 4000,  min: 4 },
  { id: 'i-salmon',  code: 'T1005', name: 'Лосось',               unit: 'кг', stock: 6,   costPerUnit: 8000,  min: 1 },
  // Бакалея / овощи
  { id: 'i-flour',   code: 'T2001', name: 'Мука',                 unit: 'кг', stock: 30,  costPerUnit: 300,   min: 5 },
  { id: 'i-rice',    code: 'T2002', name: 'Рис',                  unit: 'кг', stock: 25,  costPerUnit: 600,   min: 5 },
  { id: 'i-potato',  code: 'T2003', name: 'Картофель',            unit: 'кг', stock: 40,  costPerUnit: 350,   min: 8 },
  { id: 'i-onion',   code: 'T2004', name: 'Лук',                  unit: 'кг', stock: 18,  costPerUnit: 250,   min: 4 },
  { id: 'i-orange',  code: 'T2005', name: 'Апельсин',             unit: 'кг', stock: 14,  costPerUnit: 800,   min: 3 },
  { id: 'i-sugar',   code: 'T2006', name: 'Сахар',                unit: 'кг', stock: 12,  costPerUnit: 320,   min: 3 },
  { id: 'i-nori',    code: 'T2007', name: 'Нори (лист)',          unit: 'шт', stock: 200, costPerUnit: 90,    min: 30 },
  // Молочка / жиры
  { id: 'i-oil',     code: 'T3001', name: 'Масло растительное',   unit: 'л',  stock: 20,  costPerUnit: 900,   min: 4 },
  { id: 'i-butter',  code: 'T3002', name: 'Масло сливочное',      unit: 'кг', stock: 8,   costPerUnit: 3500,  min: 2 },
  { id: 'i-milk',    code: 'T3003', name: 'Молоко',               unit: 'л',  stock: 25,  costPerUnit: 450,   min: 5 },
  { id: 'i-cream',   code: 'T3004', name: 'Сливки',               unit: 'л',  stock: 6,   costPerUnit: 1500,  min: 1 },
  { id: 'i-masc',    code: 'T3005', name: 'Маскарпоне',           unit: 'кг', stock: 5,   costPerUnit: 6000,  min: 1 },
  { id: 'i-egg',     code: 'T3006', name: 'Яйцо',                 unit: 'шт', stock: 120, costPerUnit: 70,    min: 24 },
  // Бар / напитки
  { id: 'i-coffee',  code: 'T4001', name: 'Кофе зерно',           unit: 'кг', stock: 5,   costPerUnit: 7000,  min: 1 },
  { id: 'i-beerkeg', code: 'T4002', name: 'Пиво разливное',       unit: 'л',  stock: 50,  costPerUnit: 700,   min: 10 },
  { id: 'i-wine',    code: 'T4003', name: 'Вино',                 unit: 'л',  stock: 15,  costPerUnit: 3000,  min: 3 },
  { id: 'i-cola',    code: 'T4004', name: 'Кола 0.5 (бут.)',      unit: 'шт', stock: 60,  costPerUnit: 350,   min: 12 },
  { id: 'i-water',   code: 'T4005', name: 'Вода 0.5 (бут.)',      unit: 'шт', stock: 80,  costPerUnit: 120,   min: 12 },
  // Розница
  { id: 'i-bag',     code: 'T5001', name: 'Пакет',                unit: 'шт', stock: 300, costPerUnit: 20,    min: 50 },
  { id: 'i-mug',     code: 'T5002', name: 'Кружка с логотипом',   unit: 'шт', stock: 24,  costPerUnit: 1500,  min: 5 },
]

// ───────────────────────── Техкарты (ТТК) ─────────────────────────
// dishId → норма закладки (брутто) на 1 порцию. Блюда без техкарты (услуги) не списывают склад.
export const techCards: Record<string, TechCardItem[]> = {
  // Горячее
  'd-rulka':  [{ ingredientId: 'i-lamb', gross: 0.5 }, { ingredientId: 'i-potato', gross: 0.2 }, { ingredientId: 'i-oil', gross: 0.03 }],
  'd-steak':  [{ ingredientId: 'i-ribeye', gross: 0.3 }, { ingredientId: 'i-butter', gross: 0.02 }, { ingredientId: 'i-oil', gross: 0.02 }],
  'd-cutlet': [{ ingredientId: 'i-chicken', gross: 0.25 }, { ingredientId: 'i-butter', gross: 0.03 }, { ingredientId: 'i-flour', gross: 0.05 }, { ingredientId: 'i-egg', gross: 1 }],
  // Национальное
  'd-besh':   [{ ingredientId: 'i-beef', gross: 0.3 }, { ingredientId: 'i-flour', gross: 0.2 }, { ingredientId: 'i-onion', gross: 0.1 }, { ingredientId: 'i-egg', gross: 1 }],
  'd-plov':   [{ ingredientId: 'i-rice', gross: 0.2 }, { ingredientId: 'i-beef', gross: 0.15 }, { ingredientId: 'i-onion', gross: 0.1 }, { ingredientId: 'i-oil', gross: 0.05 }],
  'd-manty':  [{ ingredientId: 'i-beef', gross: 0.15 }, { ingredientId: 'i-flour', gross: 0.15 }, { ingredientId: 'i-onion', gross: 0.08 }],
  'd-lagman': [{ ingredientId: 'i-beef', gross: 0.15 }, { ingredientId: 'i-flour', gross: 0.12 }, { ingredientId: 'i-onion', gross: 0.08 }, { ingredientId: 'i-oil', gross: 0.03 }],
  // Напитки
  'd-cola':   [{ ingredientId: 'i-cola', gross: 1 }],
  'd-water':  [{ ingredientId: 'i-water', gross: 1 }],
  'd-juice':  [{ ingredientId: 'i-orange', gross: 0.4 }],
  // Кофейня
  'd-cappu':  [{ ingredientId: 'i-coffee', gross: 0.018 }, { ingredientId: 'i-milk', gross: 0.15 }],
  'd-latte':  [{ ingredientId: 'i-coffee', gross: 0.018 }, { ingredientId: 'i-milk', gross: 0.2 }],
  'd-esp':    [{ ingredientId: 'i-coffee', gross: 0.009 }],
  // Бар
  'd-beer':   [{ ingredientId: 'i-beerkeg', gross: 0.5 }],
  'd-wine':   [{ ingredientId: 'i-wine', gross: 0.15 }],
  // Десерты
  'd-tira':   [{ ingredientId: 'i-masc', gross: 0.08 }, { ingredientId: 'i-cream', gross: 0.05 }, { ingredientId: 'i-egg', gross: 1 }, { ingredientId: 'i-sugar', gross: 0.03 }, { ingredientId: 'i-coffee', gross: 0.005 }],
  'd-cali':   [{ ingredientId: 'i-rice', gross: 0.1 }, { ingredientId: 'i-salmon', gross: 0.05 }, { ingredientId: 'i-nori', gross: 1 }],
  // Товары (розница)
  'd-pack':   [{ ingredientId: 'i-bag', gross: 1 }],
  'd-merch':  [{ ingredientId: 'i-mug', gross: 1 }],
  // Услуги (d-deliv, d-cork) — без техкарты, склад не трогают.
}

// ───────────────────────── Расчёты ─────────────────────────
const byId = (ings: Ingredient[]) => {
  const m: Record<string, Ingredient> = {}
  for (const i of ings) m[i.id] = i
  return m
}

// Себестоимость блюда из техкарты (₸). 0 — если техкарты нет (услуга).
export function dishCost(dishId: string, ings: Ingredient[]): number {
  const card = techCards[dishId]
  if (!card) return 0
  const m = byId(ings)
  return +card.reduce((s, it) => s + it.gross * (m[it.ingredientId]?.costPerUnit ?? 0), 0).toFixed(2)
}

// Сколько порций блюда можно собрать из текущих остатков. Infinity — если техкарты нет.
export function dishMaxPortions(dishId: string, ings: Ingredient[]): number {
  const card = techCards[dishId]
  if (!card || card.length === 0) return Infinity
  const m = byId(ings)
  let min = Infinity
  for (const it of card) {
    const ing = m[it.ingredientId]
    if (!ing || it.gross <= 0) continue
    min = Math.min(min, Math.floor(ing.stock / it.gross))
  }
  return min < 0 ? 0 : min
}

// Списание ингредиентов по строкам заказа (аналог Акта реализации). Возвращает новый массив остатков.
export function applyWriteoff(ings: Ingredient[], lines: OrderLine[]): Ingredient[] {
  const delta: Record<string, number> = {}
  for (const l of lines) {
    const card = techCards[l.dishId]
    if (!card) continue
    for (const it of card) delta[it.ingredientId] = (delta[it.ingredientId] ?? 0) + it.gross * l.qty
  }
  return ings.map((i) => (delta[i.id] ? { ...i, stock: +(i.stock - delta[i.id]).toFixed(3) } : i))
}

export const findIngredient = (id: string, ings: Ingredient[]) => ings.find((i) => i.id === id)
export const hasTechCard = (dishId: string) => Boolean(techCards[dishId])
