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
  store?: string        // склад хранения (фильтр «Склад ▾» в остатках); по умолч. «Основной склад»
}

// Строка техкарты (ТТК): закладка ингредиента на 1 порцию блюда.
// Списание и себестоимость считаются по БРУТТО; потери — расчётные (нетто/выход) для калькуляционной карты.
// Нетто = Брутто × (1 − потери хол. %/100); Выход = Нетто × (1 − потери гор. %/100). См. iiko_spec/04_tovary_i_sklady.md.
export interface TechCardItem {
  ingredientId: string
  gross: number          // норма закладки, брутто, в ед. ингредиента
  coldLossPct?: number   // потери при холодной обработке, % (по умолч. 0)
  hotLossPct?: number    // потери при горячей обработке, % (по умолч. 0)
}

export interface StopItem {
  dishId: string       // '' если это стоп модификатора (по optionId)
  optionId?: string    // стоп конкретного модификатора (опции), а не блюда
  name?: string        // отображаемое имя (для модификатора — название опции)
  remaining?: number   // остаток порций; undefined = полный стоп (недоступно). >0 — продаётся, тает, при 0 → стоп
  scope?: string       // область стопа: 'all'/undefined = везде; hallId = только зал; 'terminal' = этот терминал
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
  comment?: string // комментарий к позиции (печатается на марке кухни)
  course?: number  // курс подачи (1/2/3…); не задан = без курса
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
  active?: boolean       // показывать на кассе (Типы оплат, офис)
  code?: string          // код для внешнего API (VISA и т.п.)
  openDrawer?: boolean   // открывать денежный ящик
  exactSum?: boolean     // устанавливать точную сумму заказа
  printReceipt?: boolean // печатать товарный чек
  combinable?: boolean   // можно комбинировать с другими типами оплаты
  discountPct?: number   // авто-скидка при этом типе оплаты, %
}

// Скидка / надбавка (Дисконтная система → Скидки и надбавки, topic-503). У нас — в процентах (под модель заказа).
export interface Discount {
  id: string
  name: string          // название в системе
  chequeName?: string   // название на чеке
  kind: 'discount' | 'surcharge'
  percent: number
  manual: boolean       // можно назначать вручную (право F_ID)
  byCard: boolean       // можно назначать по клубной карте
  auto: boolean         // устанавливать автоматически
  minSum?: number       // применять, если сумма заказа не менее
  fromTime?: string     // «счастливый час»: с (ЧЧ:ММ)
  toTime?: string       // по (ЧЧ:ММ)
}

// Клубная (дисконтная) карта гостя (Дисконтная система → Клубные карты, topic-502).
export interface ClubCard {
  id: string
  number: string
  owner: string
  discountId: string    // тип скидки (из скидок со способом «по карте»)
}

// Тип внесения/изъятия наличных (Розничные продажи → Типы внесений/изъятий, topic-102).
export interface CashOpType {
  id: string
  name: string
  direction: 'in' | 'out'   // внесение / изъятие
  requireComment?: boolean   // требовать ввода комментария в iikoFront
  limit?: number             // лимит суммы (0/undefined — без лимита)
  manual: boolean            // доступен для ручного ввода в iikoFront
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

export interface DocLine {
  ingredientId: string
  name: string
  unit: string
  qty: number
  booked?: number    // учётный остаток на момент инвентаризации (для расчёта отклонения)
}

export interface StoreDoc {
  id: number
  type: DocType
  at: string
  by: string         // кто оформил
  store: string      // склад (для перемещения — источник)
  toStore?: string   // склад-получатель (для внутреннего перемещения)
  result?: string    // блюдо/полуфабрикат-результат (для акта приготовления/переработки)
  reason?: string    // причина (для акта списания)
  lines: DocLine[]
}

export interface Staff {
  id: string
  name: string
  pin: string
  positions: string[]
  card?: string // номер магнитной карты сотрудника (вход прокаткой карты)
}

// Выплата сотруднику (платёжная ведомость iiko): аванс (середина месяца) или расчёт (конец).
// Метод начисления: сначала начислено (оклад − налоги), затем выдаётся аванс + расчёт.
export interface SalaryPayout {
  id: number
  staffId: string
  kind: 'advance' | 'settlement' // аванс / расчёт
  amount: number
  at: string
  by: string // кто провёл (офис)
}

// Мотивационная программа (Сотрудники → Мотивационные программы, topic-313).
// Начисление за личные продажи сотрудника (waiter) по заказам, закрытым в смене.
export interface MotivationProgram {
  id: string
  name: string
  scope: 'all' | 'dish' | 'group' // все блюда / конкретное блюдо / категория
  targetId?: string               // dishId или groupId (для scope dish/group)
  mode: 'percent' | 'perUnit'     // % от выручки / фикс. ₸ за проданную единицу
  value: number
  minQty?: number                 // порог: продать не менее N (иначе премия 0)
  active: boolean
}

// Удержание/штраф сотруднику (операция ведомости «Удержать», topic-313/06).
export interface SalaryDeduction {
  id: number
  staffId: string
  amount: number
  reason: string
  at: string
}

// Приказ об изменении цен (Прейскурант, iikoOffice). Активация → цены уезжают на кассу.
export interface PriceOrderLine {
  dishId: string
  name: string
  oldPrice: number
  newPrice: number
}

export interface PriceOrder {
  id: number
  no: string          // № приказа
  date: string        // дата вступления в силу (ISO YYYY-MM-DD)
  note: string
  status: 'draft' | 'active'
  lines: PriceOrderLine[]
  createdAt: string
}

export interface Contractor {
  id: string
  name: string
  bin: string // БИН (ТОО) / ИИН (ИП)
}

export interface InvoiceLine { ingredientId: string; name: string; qty: number; price: number }

// Приходная накладная (KZ) = входящая ЭСФ от поставщика. Увеличивает остаток склада.
export interface Invoice {
  id: number
  no: string          // № приходной накладной
  date: string
  supplierName: string
  supplierBin: string
  lines: InvoiceLine[]
  total: number       // сумма с ҚҚС
  vat: number         // ҚҚС в т.ч. (16%)
  esfNo: string       // № ЭСФ (ИС ЭСФ)
  kind?: 'in' | 'out' // входящая (приход от поставщика) / исходящая (покупателю)
}

export interface Message {
  id: number
  from: string
  date: string
  title: string
  body: string
  unread: boolean
  important?: boolean // важное сообщение — выделяется красным
  attachments?: string[] // вложения (имена файлов; печать/скачивание — мок)
  outgoing?: boolean      // исходящий ответ сотрудника (в офис)
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
  openingCash?: number // начальный остаток наличных (разменный фонд) при открытии смены
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
  qtyByUid?: Record<string, number> // дробный возврат: сколько единиц каждой позиции возвращено
  reason: string     // причина возврата
  restock: boolean   // вернуть товар на склад (возврат со списанием на склад)
  method: 'cash' | 'card' // способ возврата денег (наличные требуют наличия в ящике)
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
  prepayment: number        // предоплата (для банкета), ₸
  prepaymentMethod?: string // способ оплаты предоплаты (Наличные / Карта / …)
  durationMin?: number      // длительность, мин (шаг 30)
}

export interface PersonalShift {
  staffId: string
  position: string
  openedAt: string
}
