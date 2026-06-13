import type { Hall, Table, PaymentType, Staff, Banquet, Message, Contractor } from '../types'
import { todayISO, addDaysISO } from '../lib/date'

// Склады заведения (для документов: списание/перемещение/инвентаризация).
export const warehouses = ['Основной склад', 'Бар', 'Кухонный цех']

// KZ Сотрудники (мок). PIN — 4 цифры (как на реальной кассе).
export const staff: Staff[] = [
  { id: 's-petrov', name: 'Петров К.С.', pin: '1111', positions: ['Кассир', 'Менеджер'] },
  { id: 's-ivanova', name: 'Иванова А.А.', pin: '2222', positions: ['Официант'] },
  { id: 's-legasov', name: 'Легасов И.Н.', pin: '3333', positions: ['Официант', 'Бармен'] },
  { id: 's-admin', name: 'Администратор', pin: '0000', positions: ['Менеджер', 'Кассир'] },
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

export const paymentTypes: PaymentType[] = [
  { id: 'p-cash', name: 'Наличные', kind: 'cash' },
  { id: 'p-card', name: 'Банковские карты', kind: 'card' },
  { id: 'p-cashless', name: 'Безналичный расчёт', kind: 'cashless' },
  { id: 'p-norev', name: 'Без выручки', kind: 'noRevenue' },
  { id: 'p-bonus', name: 'Бонусная карта', kind: 'bonus' },
]

// Типы внесения/изъятия наличных (настраиваются в офисе, тут мок).
export const cashInTypes = ['Внесение разменной монеты', 'Внесение на официанта', 'Прочее внесение']
export const cashOutTypes = ['Изъятие (инкассация)', 'Изъятие под отчёт', 'Выдача аванса (зарплата)', 'Выплата зарплаты', 'Прочее изъятие']

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
  { id: 3, from: 'Бухгалтерия', date: 'Вчера 18:40', title: 'Переход на ҚҚС 16%', body: 'С 01.01.2026 ставка НДС 16%. Проверьте налоговые категории и Webkassa.', unread: false, important: true },
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
