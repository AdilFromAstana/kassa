import type { Hall, Table, PaymentType, Staff, Banquet, Message, Contractor, Discount, ClubCard, MotivationProgram, OrderTypeDef, LoyaltyCard, LoyaltyProgram, License, PrintTemplate, InputDevice, DeliveryCustomer, Courier, DeliveryOrder, DeliverySettings } from '../types'
import { todayISO, addDaysISO } from '../lib/date'

// Склады заведения (для документов: списание/перемещение/инвентаризация).
export const warehouses = ['Основной склад', 'Бар', 'Кухонный цех']

// KZ Сотрудники (мок). PIN — 4 цифры (как на реальной кассе).
export const staff: Staff[] = [
  { id: 's-petrov', name: 'Петров К.С.', pin: '1111', positions: ['Кассир', 'Менеджер'], card: '0004915711' },
  { id: 's-ivanova', name: 'Иванова А.А.', pin: '2222', positions: ['Официант'], card: '0004915722' },
  { id: 's-legasov', name: 'Легасов И.Н.', pin: '3333', positions: ['Официант', 'Бармен'], card: '0004915733' },
  { id: 's-admin', name: 'Администратор', pin: '0000', positions: ['Менеджер', 'Кассир'], card: '0004915700' },
]

export const halls: Hall[] = [
  { id: 'h-hall', name: 'Зал' },
  { id: 'h-bar', name: 'Бар' },
  { id: 'h-veranda', name: 'Веранда' },
]

// Схема столов (грид x/y) по залам.
export const tables: Table[] = [
  // Зал
  { id: 't-1', hallId: 'h-hall', no: '1', seats: 2, x: 0, y: 0 },
  { id: 't-2', hallId: 'h-hall', no: '2', seats: 4, x: 1, y: 0 },
  { id: 't-3', hallId: 'h-hall', no: '3', seats: 4, x: 2, y: 0 },
  { id: 't-4', hallId: 'h-hall', no: '4', seats: 6, x: 0, y: 1 },
  { id: 't-5', hallId: 'h-hall', no: '5', seats: 2, x: 1, y: 1 },
  { id: 't-6', hallId: 'h-hall', no: '6', seats: 2, x: 2, y: 1 },
  { id: 't-7', hallId: 'h-hall', no: '7', seats: 8, x: 0, y: 2 },
  { id: 't-8', hallId: 'h-hall', no: '8', seats: 4, x: 1, y: 2 },
  // Бар
  { id: 't-b1', hallId: 'h-bar', no: 'Б1', seats: 1, x: 0, y: 0 },
  { id: 't-b2', hallId: 'h-bar', no: 'Б2', seats: 1, x: 1, y: 0 },
  { id: 't-b3', hallId: 'h-bar', no: 'Б3', seats: 1, x: 2, y: 0 },
  { id: 't-b4', hallId: 'h-bar', no: 'Б4', seats: 4, x: 0, y: 1 },
  // Веранда
  { id: 't-v1', hallId: 'h-veranda', no: 'В1', seats: 4, x: 0, y: 0 },
  { id: 't-v2', hallId: 'h-veranda', no: 'В2', seats: 4, x: 1, y: 0 },
  { id: 't-v3', hallId: 'h-veranda', no: 'В3', seats: 6, x: 0, y: 1 },
]

// Типы заказов (Розничные продажи → Типы заказов, topic-112). Один тип на режим, «В зале» — по умолчанию.
export const orderTypesSeed: OrderTypeDef[] = [
  { id: 'ot-dinein', name: 'Обслуживание в зале', mode: 'dinein', isDefault: true, vat: 16 },
  { id: 'ot-takeaway', name: 'На вынос', mode: 'takeaway', vat: 16 },
  { id: 'ot-delivery', name: 'Доставка', mode: 'delivery', vat: 16 },
]

export const paymentTypes: PaymentType[] = [
  { id: 'p-cash', name: 'Наличные', kind: 'cash', active: true, code: 'CASH', openDrawer: true, exactSum: false, combinable: true },
  { id: 'p-card', name: 'Банковские карты', kind: 'card', active: true, code: 'CARD', openDrawer: false, exactSum: true, combinable: true },
  { id: 'p-cashless', name: 'Безналичный расчёт', kind: 'cashless', active: true, code: 'BANK', exactSum: true, combinable: true },
  { id: 'p-norev', name: 'Без выручки', kind: 'noRevenue', active: true, code: 'NOREV', combinable: false },
  { id: 'p-bonus', name: 'Бонусная карта', kind: 'bonus', active: false, code: 'BONUS', combinable: true },
]

// Типы внесения/изъятия наличных (настраиваются в офисе, тут мок).
export const cashInTypes = ['Внесение разменной монеты', 'Внесение на официанта', 'Прочее внесение']
export const cashOutTypes = ['Изъятие (инкассация)', 'Изъятие под отчёт', 'Выдача аванса (зарплата)', 'Выплата зарплаты', 'Прочее изъятие']

// Сиды для офисных справочников Розничных продаж (раздел 03): типы внесений/изъятий + причины списания.
export const cashOpTypeSeed = [
  ...cashInTypes.map((name, i) => ({ id: `ci-${i}`, name, direction: 'in' as const, manual: true })),
  ...cashOutTypes.map((name, i) => ({ id: `co-${i}`, name, direction: 'out' as const, manual: true })),
]
export const writeoffReasonSeed = ['Бой / порча', 'Просрочка', 'Проработка', 'Дегустация', 'Прочее']

// Дисконтная система (раздел 10): скидки/надбавки + клубные карты — настраиваются в офисе.
export const discountSeed: Discount[] = [
  { id: 'd-staff', name: 'Скидка персоналу', chequeName: 'Скидка персоналу', kind: 'discount', percent: 20, manual: true, byCard: false, auto: false },
  { id: 'd-gold', name: 'Золотая карта', chequeName: 'Скидка по карте', kind: 'discount', percent: 10, manual: false, byCard: true, auto: false },
  { id: 'd-happy', name: 'Счастливый час', chequeName: 'Happy hour', kind: 'discount', percent: 15, manual: true, byCard: false, auto: false, fromTime: '14:00', toTime: '16:00' },
  { id: 'd-banket', name: 'Скидка от 50 000 ₸', kind: 'discount', percent: 5, manual: true, byCard: false, auto: false, minSum: 50000 },
  { id: 's-service', name: 'Надбавка за обслуживание', chequeName: 'Обслуживание', kind: 'surcharge', percent: 10, manual: true, byCard: false, auto: false },
]
export const clubCardSeed: ClubCard[] = [
  { id: 'card-1', number: '7700 0001', owner: 'Алия Ж.', discountId: 'd-gold' },
]

// iikoCard — бонусная программа лояльности (модуль 15) + карты гостей с балансом бонусов.
// ───────── Доставка (модуль 14, iikoDelivery) ─────────
export const deliverySettingsSeed: DeliverySettings = {
  durationMin: 60, minSum: 3000, feeAmount: 800,
  cities: ['Астана', 'Алматы', 'Шымкент'],
  streets: ['пр. Кабанбай батыра', 'ул. Сарайшык', 'пр. Туран', 'ул. Достык', 'ул. Кенесары'],
  districts: ['Есиль', 'Алматы р-н', 'Сарыарка', 'Байконыр'],
}
export const couriersSeed: Courier[] = [
  { id: 'cr-1', name: 'Ермек Т.', onShift: true },
  { id: 'cr-2', name: 'Нурлан А.', onShift: true },
  { id: 'cr-3', name: 'Асхат Б.', onShift: false },
]
export const deliveryCustomersSeed: DeliveryCustomer[] = [
  { id: 'dc-1', name: 'Данияр К.', phone: '+7 701 111 22 33', street: 'пр. Кабанбай батыра', house: '11', apt: '45', district: 'Есиль', adSource: 'Сайт', highRisk: false, comment: '' },
  { id: 'dc-2', name: 'Самал Е.', phone: '+7 705 222 33 44', street: 'ул. Сарайшык', house: '7', apt: '12', district: 'Есиль', adSource: 'Instagram', highRisk: false, comment: 'код подъезда 1234' },
  { id: 'dc-3', name: 'Руслан М.', phone: '+7 707 999 88 77', street: 'пр. Туран', house: '24', apt: '88', district: 'Сарыарка', adSource: 'Листовка', highRisk: true, comment: 'отказы от заказов' },
]
export const deliveryOrdersSeed: DeliveryOrder[] = [
  { id: 1, no: 'Д-1001', type: 'courier', customerName: 'Данияр К.', phone: '+7 701 111 22 33', address: 'пр. Кабанбай батыра 11, кв. 45 · Есиль', adSource: 'Сайт', items: [{ name: 'Бесбармак астау', qty: 1, price: 70000 }, { name: 'Кола 0.5', qty: 2, price: 800 }], goods: 71600, fee: 800, status: 'new', createdAt: 'Сегодня 18:20' },
  { id: 2, no: 'Д-1002', type: 'courier', customerName: 'Самал Е.', phone: '+7 705 222 33 44', address: 'ул. Сарайшык 7, кв. 12 · Есиль', adSource: 'Instagram', items: [{ name: 'Лагман', qty: 2, price: 5000 }], goods: 10000, fee: 800, status: 'cooking', createdAt: 'Сегодня 18:05' },
  { id: 3, no: 'Д-1003', type: 'pickup', customerName: 'Руслан М.', phone: '+7 707 999 88 77', address: 'Самовывоз', adSource: 'Листовка', items: [{ name: 'Манты (5 шт)', qty: 1, price: 4500 }], goods: 4500, fee: 0, status: 'onway', courierId: 'cr-1', createdAt: 'Сегодня 17:40' },
]

// ───────── Администрирование (модуль 12): лицензии, печатные формы, устройства ввода ─────────
export const licenseClientIdSeed = 'KZ-7700-MUMTAZ'
export const licensesSeed: License[] = [
  { id: 'l-server', module: 'iikoServer RMS', count: 1, from: '2026-01-01', to: '2026-12-31' },
  { id: 'l-front', module: 'iikoFront (TableService)', count: 2, from: '2026-01-01', to: '2026-12-31' },
  { id: 'l-office', module: 'iikoOffice', count: 1, from: '2026-01-01', to: '2026-12-31' },
  { id: 'l-kitchen', module: 'iikoKitchen (KDS)', count: 1, from: '2026-01-01', to: '2026-12-31' },
  { id: 'l-delivery', module: 'iikoDelivery', count: 1, from: '2026-01-01', to: '2026-12-31' },
  { id: 'l-card', module: 'iikoCard (лояльность)', count: 1, from: '2026-01-01', to: '2026-12-31' },
]
export const printTemplatesSeed: PrintTemplate[] = [
  { id: 'pt-cheque', name: 'Фискальный чек', type: 'Чек', kind: 'standard' },
  { id: 'pt-precheck', name: 'Пречек (предварительный счёт)', type: 'Пречек', kind: 'standard' },
  { id: 'pt-goods', name: 'Товарный чек', type: 'Товарный чек', kind: 'standard' },
  { id: 'pt-zreport', name: 'Z-отчёт смены', type: 'Z-отчёт', kind: 'standard' },
  { id: 'pt-invoice', name: 'Приходная накладная (РК)', type: 'Приходная накладная', kind: 'standard' },
  { id: 'pt-writeoff', name: 'Акт списания (РК)', type: 'Акт списания', kind: 'standard' },
  { id: 'pt-kitchen', name: 'Марка на кухню', type: 'Сервисный чек', kind: 'custom' },
]
export const inputDevicesSeed: InputDevice[] = [
  { id: 'd-kbd', name: 'Клавиатура', type: 'Клавиатура', group: 'keyboard' },
  { id: 'd-scan', name: 'Сканер ШК (USB)', type: 'Сканер штрихкода', group: 'pos' },
  { id: 'd-msr', name: 'Считыватель карт', type: 'Считыватель магнитных карт', group: 'keyboard' },
]

export const loyaltyProgramSeed: LoyaltyProgram = { active: true, accrualPct: 5, redeemLimitPct: 50, welcomeBonus: 1000 }
export const loyaltyCardsSeed: LoyaltyCard[] = [
  { id: 'lc-1', number: '7711 0001', owner: 'Данияр К.', phone: '+7 701 111 22 33', balance: 4200 },
  { id: 'lc-2', number: '7711 0002', owner: 'Самал Е.', phone: '+7 705 222 33 44', balance: 750 },
]

// Мотивационные программы (раздел 06) — начисление премии за личные продажи.
export const motivationSeed: MotivationProgram[] = [
  { id: 'm-rev', name: 'Официанту % с выручки', scope: 'all', mode: 'percent', value: 5, active: true },
  { id: 'm-dessert', name: 'Премия за десерты', scope: 'group', targetId: 'g-dessert', mode: 'percent', value: 3, active: true },
]

// Стартовые банкеты/резервы (мок).
export const initialBanquets: Banquet[] = [
  { id: 1, type: 'Резерв', status: 'Действует', hallId: 'h-hall', tableId: 't-4', date: todayISO(), time: '18:00', guests: 6, clientName: 'Алия', clientPhone: '+7 701 234 56 78', comment: 'У окна', prepayment: 0, durationMin: 120 },
  { id: 2, type: 'Банкет', status: 'Действует', hallId: 'h-veranda', tableId: 't-v3', date: todayISO(), time: '19:30', guests: 12, clientName: 'ТОО «Астана»', clientPhone: '+7 717 000 11 22', comment: 'Поставить цветы', prepayment: 50000, prepaymentMethod: 'Банковские карты', durationMin: 180 },
  { id: 3, type: 'Резерв', status: 'Действует', hallId: 'h-hall', tableId: 't-7', date: addDaysISO(todayISO(), 1), time: '13:00', guests: 8, clientName: 'Данияр', clientPhone: '+7 705 111 22 33', comment: '', prepayment: 0, durationMin: 120 },
]

// KZ Фискальные регистраторы (Webkassa) — мок, 2 ФР на кассе (разные юрлица).
export const fiscalRegistrators = [
  { id: 'fr1', name: 'ФР №1 (алкоголь)', model: 'Webkassa Online', serial: 'KZ-0001-2024', fn: '99078900012345', org: 'ТОО «Мумтаз»', bin: '123456789012', shiftOpen: true, receipts: 1 },
  { id: 'fr2', name: 'ФР №2 (кухня)', model: 'Webkassa Online', serial: 'KZ-0002-2024', fn: '99078900067890', org: 'ИП Касымов', bin: '870101300123', shiftOpen: false, receipts: 0 },
]

// Журнал явок (мок) — приход/уход сотрудников за день.
export const attendance = [
  { staff: 'Петров К.С.', position: 'Кассир', date: 'Сегодня', in: '08:55', out: '', type: 'Отработано' },
  { staff: 'Иванова А.А.', position: 'Официант', date: 'Сегодня', in: '09:02', out: '', type: 'Отработано' },
  { staff: 'Легасов И.Н.', position: 'Бармен', date: 'Сегодня', in: '10:00', out: '', type: 'Отработано' },
  { staff: 'Сидоров П.П.', position: 'Повар', date: 'Сегодня', in: '', out: '', type: 'Прогул' },
]

// Внутренние сообщения / новости (мок).
export const messages: Message[] = [
  { id: 1, from: 'Управляющий', date: 'Сегодня 09:30', title: 'План продаж на месяц', body: 'Целевая выручка обновлена. Акцент на кофе и десерты — мотивационная программа активна.', unread: true },
  { id: 2, from: 'Шеф-повар', date: 'Сегодня 08:10', title: 'Стоп-лист на утро', body: 'Бесбармак временно недоступен (нет конины). Обновите при поступлении.', unread: true, important: true },
  { id: 3, from: 'Бухгалтерия', date: 'Вчера 18:40', title: 'Переход на ҚҚС 16%', body: 'С 01.01.2026 ставка НДС 16%. Проверьте налоговые категории и Webkassa.', unread: false, important: true, attachments: ['Памятка_ҚҚС_16.pdf', 'Налоговые_категории.xlsx'] },
]

// Контрагенты-поставщики (KZ, БИН/ИИН) — мок.
export const contractors: Contractor[] = [
  { id: 'c-meat', name: 'ТОО «Мясокомбинат Астана»', bin: '050340001234' },
  { id: 'c-veg', name: 'ИП Овощебаза', bin: '870101300555' },
  { id: 'c-drinks', name: 'ТОО «Напитки KZ»', bin: '120640002233' },
]

export const tablesByHall = (hallId: string) => tables.filter((t) => t.hallId === hallId)
export const findStaffByPin = (pin: string) => staff.find((s) => s.pin === pin)
export const findTable = (id: string) => tables.find((t) => t.id === id)
