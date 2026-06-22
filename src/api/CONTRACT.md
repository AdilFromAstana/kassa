# API CONTRACT — переезд мок-кассы на реальный бэкенд

Слой данных скрыт за интерфейсом `PosRepository` (`src/api/contract.ts`).
Сейчас активна `localRepository` (localStorage). Чтобы подключить бэкенд:

1. Поднять REST по таблице ниже.
2. Заполнить `fetch` в `src/api/httpRepository.ts` (заготовка готова).
3. В `src/api/index.ts` переключить `export const repo = httpRepository`.
4. (Опц.) выставить `VITE_API_BASE` (по умолчанию `/api`).

UI и стор при этом **не меняются** — сигнатуры методов одинаковы.

## Методы → эндпоинты
| Метод репозитория | HTTP | Тело/ответ |
|---|---|---|
| `loadConfig(key, fallback)` | `GET /api/config/:key` | ответ: JSON-значение; `404`/пусто → клиент берёт `fallback` (сид) |
| `saveConfig(key, value)` | `PUT /api/config/:key` | тело: JSON-значение |
| `remove(key)` | `DELETE /api/config/:key` | — |
| `loadRuntime()` | `GET /api/runtime` | ответ: снимок оперативного слоя (объект) |
| `saveRuntime(snapshot)` | `PUT /api/runtime` | тело: снимок оперативного слоя |

> Минимальная модель — key-value + снимок runtime. Этого достаточно для переезда без переписывания UI.
> Когда захотите «настоящие» доменные эндпоинты (orders.create, shift.close, …) — их можно добавить в `PosRepository` поверх, не ломая существующее.

## Конфиг-ключи (то, что ходит через config/:key)
Заведение/режим: `iiko-establishment` · Меню/цены: `iiko-menu-prices`, `iiko-price-categories`, `iiko-category-prices`, `iiko-price-orders` · Склад: `iiko-stock`, `iiko-techcards` · Справочники: `iiko-staff`, `iiko-payment-types`, `iiko-order-types`, `iiko-cashop-types`, `iiko-writeoff-reasons`, `iiko-shift-types`, `iiko-med-checks`, `iiko-pay-profiles` · Права: `iiko-role-rights` · Дисконт: `iiko-discounts`, `iiko-club-cards` · Лояльность: `iiko-loyalty-program`, `iiko-loyalty-cards`, `iiko-promo-actions`, `iiko-deposit-program`, `iiko-certificates` · Бухгалтерия/контрагенты: `iiko-contractors`, `iiko-invoices`, `iiko-postings` · Зарплата/мотивация: `iiko-salary`, `iiko-motivation`, `iiko-deductions` · Корпорация: `iiko-corp-settings`, `iiko-corp-tree`, `iiko-concepts`, `iiko-doc-numbering` · Доставка: `iiko-delivery-settings`, `iiko-couriers`, `iiko-delivery-customers`, `iiko-delivery-orders` · Администрирование: `iiko-license-clientid`, `iiko-licenses`, `iiko-print-templates`, `iiko-input-devices` · Демо: `iiko-demo-auto` · OLAP-отчёты: `iiko-olap-reports` · Платежи/задолженность: `iiko-invoice-paid` · Расписание смен: `iiko-shift-schedule` · Быстрое меню: `iiko-quick-menu` · План-факт: `iiko-plan-fact`

## Оперативный слой (`/api/runtime`)
Один снимок: `cashShift, cashShiftSeq, orders, closedOrders, currentOrderId, orderSeq, fiscalSeq, cashMovements, refunds, writeOffs, documents, docSeq, banquets, closedShifts, stopList, messages, movementSeq, refundSeq, banquetSeq`.

## Замечание про асинхронность
`localRepository` резолвит промисы мгновенно (sync-init сохраняется). У `httpRepository` старт асинхронный — при подключении добавить гидратацию с флагом `ready` (короткий сплэш), запись (`save*`) остаётся fire-and-forget.
