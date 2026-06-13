// Доменные типы кассы (мок). KZ валюта — тенге ₸, НДС (ҚҚС) 16%.

export type VatRate = 16 | 0 // основная / без НДС

export interface ModifierOption {
  id: string
  name: string
  price: number // ₸, 0 = бесплатный
}

export interface ModifierGroup {
  id: string
  name: string
  min: number
  max: number
  options: ModifierOption[]
}

export interface Dish {
  id: string
  name: string
  code: string // артикул/код для поиска и сканера
  price: number // ₸
  vat: VatRate
  groupId: string
  color?: string // цвет плитки
  modifierGroupIds?: string[]
  isWeight?: boolean
  // метод списания со склада (iiko): 'ingredients' = по техкарте, 'finished' = как готовое блюдо.
  // не задан → услуга/без склада (не списывается).
  writeoffMethod?: 'ingredients' | 'finished'
}

// ───────── склад (iikoOperation): товары-ингредиенты + техкарты ─────────
export type Unit = 'кг' | 'л' | 'шт'

// Товар-ингредиент на складе (номенклатура типа «Товар»). Остаток убывает при продаже блюд.
export interface Ingredient {
  id: string
  code: string         // артикул
  name: string
  unit: Unit
  stock: number        // текущий остаток на складе
  costPerUnit: number  // себестоимость за единицу, ₸ (оценочная)
  min: number          // минимальный остаток (ниже — предупреждение)
}

// Строка техкарты (ТТК): сколько ингредиента (брутто) уходит на 1 порцию блюда.
export interface TechCardItem {
  ingredientId: string
  gross: number        // норма закладки, брутто, в ед. ингредиента
}

export interface StopItem {
  dishId: string
  remaining?: number   // остаток порций; undefined = полный стоп (недоступно). >0 — продаётся, тает, при 0 → стоп
  byName: string       // кто внёс
  at: string           // когда (дата-время)
}

export interface MenuGroup {
  id: string
  name: string
  page: 1 | 2 | 3 // закладка быстрого меню I/II/III
}

export interface SelectedModifier {
  optionId: string
  name: string
  price: number
  qty: number
}

export interface OrderLine {
  uid: string // уникальный id строки заказа
  dishId: string
  name: string
  price: number // цена за единицу (без модификаторов)
  vat: VatRate
  qty: number
  modifiers: SelectedModifier[]
  guestNo?: number // для деления между гостями
}

export type OrderType = 'dinein' | 'takeaway' | 'delivery'

export interface Order {
  id: number
  tableId: string | null // null = быстрый чек
  hallId: string | null
  guests: number
  waiter: string
  type: OrderType
  lines: OrderLine[]
  discountPct: number
  surchargePct: number
  openedAt: string
  status: 'open' | 'precheck' | 'fiscalized' | 'paid'
}

export type PaymentKind = 'cash' | 'card' | 'noRevenue' | 'cashless' | 'bonus'

export interface PaymentType {
  id: string
  name: string
  kind: PaymentKind
}

export interface PaymentSplit {
  paymentTypeId: string
  name: string
  amount: number
}

export interface ClosedOrder extends Order {
  paidAt: string
  payments: PaymentSplit[]
  change: number
  total: number
  fiscalDocNo: string // номер фискального документа (Webkassa, мок)
  tip?: number        // чаевые (для отчёта 054), ₸ — сверх суммы чека
  staffMeal?: boolean // питание персонала (оплата «Без выручки», отчёт 032)
}

// Акт списания блюда со склада (для отчётов 024/034 «Списания блюд»).
export interface WriteOff {
  id: number
  dishId: string
  name: string
  qty: number
  reason: string // причина: бой/порча/проработка/дегустация
  cost: number   // себестоимость списания, ₸
  at: string
}

// Складские документы на кассе (iikoFront «Документы»). Каждая операция — отдельный документ.
// Приходной накладной на терминале нет (это офис). См. iiko_spec/04_tovary_i_sklady.md.
export type DocType =
  | 'Акт списания'
  | 'Акт приготовления'
  | 'Акт переработки'
  | 'Внутреннее перемещение'
  | 'Расходная накладная'
  | 'Инвентаризация'

export interface DocLine { ingredientId: string; name: string; unit: string; qty: number }

export interface StoreDoc {
  id: number
  type: DocType
  at: string
  by: string         // кто оформил
  store: string      // склад
  reason?: string    // причина (для акта списания)
  lines: DocLine[]
}

export interface Staff {
  id: string
  name: string
  pin: string
  positions: string[]
}

export interface Message {
  id: number
  from: string
  date: string
  title: string
  body: string
  unread: boolean
  important?: boolean // важное сообщение — выделяется красным
}

export interface Table {
  id: string
  hallId: string
  no: string
  seats: number
  x: number // позиция на схеме (грид)
  y: number
}

export interface Hall {
  id: string
  name: string
}

export interface CashShift {
  no: number
  openedAt: string
  openedBy: string
  closedAt?: string
}

// Профиль заведения (в реальной айке приходит из офиса: режим терминала + настройки ТП + лицензии).
// У нас — задаётся на экране «Настройки заведения», управляет видимостью кнопок по всему фронту.
export type ServiceMode = 'restaurant' | 'fastfood'
export interface Establishment {
  name: string
  mode: ServiceMode
  precheck: boolean      // печать пречека (ресторан)
  comments: boolean      // комментарии к заказу/блюду
  courses: boolean       // курсы подачи
  tab: boolean           // барный таб
  mix: boolean           // составное/комбо (MIX)
  kitchenScreen: boolean // кухонный экран → «Вне очереди», печать на кухню
  banquets: boolean      // банкеты и резервы
  delivery: boolean      // доставка (iikoDelivery)
  iikoCard: boolean      // лояльность
  fiscalBeforePay: boolean // раздельная печать фискального чека перед оплатой (iikoFront 9.x, приходит из офиса)
  frCount: 1 | 2         // число фискальных регистраторов
}

export interface ClosedShift {
  no: number
  openedAt: string
  closedAt: string
  orders: ClosedOrder[]
  revenue: number
}

export interface CashMovement {
  id: number
  kind: 'in' | 'out' // внесение / изъятие
  type: string // тип внесения/изъятия
  amount: number
  comment: string
  at: string
}

export interface Refund {
  id: number
  orderId: number
  fiscalDocNo: string // номер возвратного чека (мок Webkassa)
  amount: number
  full: boolean
  lineUids: string[] // какие позиции вернули (для частичного)
  reason: string     // причина возврата
  restock: boolean   // вернуть товар на склад (возврат со списанием на склад)
  at: string
  by: string         // кто авторизовал (право F_STRN / F_SWWOFF)
}

export type BanquetType = 'Банкет' | 'Резерв'
export type BanquetStatus = 'Действует' | 'Гость пришёл' | 'Снят'

export interface Banquet {
  id: number
  type: BanquetType
  status: BanquetStatus
  hallId: string
  tableId: string
  date: string
  time: string
  guests: number
  clientName: string
  clientPhone: string
  comment: string
  prepayment: number // предоплата (для банкета)
}

export interface PersonalShift {
  staffId: string
  position: string
  openedAt: string
}
