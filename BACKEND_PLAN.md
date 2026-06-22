# BACKEND_PLAN.md — план реализации бэкенда iiko-POS (KZ)

> **Что строим:** полноценный backend под уже готовый фронт-мок (касса iikoFront + офис iikoOffice). БД, EF-модели, миграции, доменные сервисы, контроллеры/эндпоинты (≈110–140, право доступа почти на каждый), RBAC, KZ-специфика.
> **Фронт не меняем** — он источник истины. Контракт `PosRepository` (`src/api/contract.ts`) сохраняем.
> **Спека модели:** [BACKEND_DESIGN.md](./BACKEND_DESIGN.md) + [migrations/001_init.sql](./migrations/001_init.sql). Этот файл — порядок работ.
> **Стек:** .NET 9 · ASP.NET Core · EF Core 9 + Npgsql · PostgreSQL 16 · JWT · xUnit + Testcontainers.

---

## Структура решения

```
backend/
  IikoPos.sln
  src/
    IikoPos.Api/             # Program.cs, DI, контроллеры/эндпоинты, auth, middleware RBAC
    IikoPos.Contracts/       # DTO (request/response), 1:1 имена с types.ts
    IikoPos.Domain/          # сущности, enum, доменные сервисы, порты lib/* (ledger, stockMoves, payables, pivot, costing, loyalty)
    IikoPos.Infrastructure/  # AppDbContext, конфигурации EF, миграции, репозитории, сидинг из mock/*
  tests/
    IikoPos.Tests/           # unit (порт *.test.ts) + интеграционные (WebApplicationFactory + Testcontainers PG)
```

**Сквозные принципы:**
- Имена полей/enum — **1:1 с `src/types.ts`** (БД snake_case, JSON camelCase через JsonNamingPolicy).
- Каждая scoped-сущность → EF **global query filter** по `trade_point_id` (claim `tp` из JWT).
- Счётчики (`*Seq`) — атомарный `UPDATE seq_counter … RETURNING`, не клиентский `+1`.
- Авторитетные операции (`pay`, списание, лояльность, фискализация) — **одна транзакция + блокировки** (FOR UPDATE / optimistic concurrency).
- Каждый эндпоинт: DTO → `[RequireRight("X_…")]` → доменный сервис → ответ.

---

## Фазы (вертикальные срезы, чекпойнт = коммит после каждой)

### Фаза 0 — Scaffold + compat-слой ⏱ ~150–300k токенов · 1–2 дня
**Цель: фронт переключается на реальный бэк (`repo = httpRepository`) без правок UI.**
- `dotnet new` solution + 4 проекта + Program.cs + DI + Npgsql + CORS + Swagger.
- `migrations/000_compat.sql` → `config_kv`, `runtime_snapshot`.
- Эндпоинты compat (`CONTRACT.md`): `GET/PUT/DELETE /api/config/:key`, `GET/PUT /api/runtime`.
- Заглушка auth (фикс. `tp`), чтобы фронт завёлся.
- **DoD:** поднять стек, в `src/api/index.ts` включить `httpRepository`, мок-касса работает на бэке (заказ→оплата→F5 не теряет данные). Заполнить `httpRepository.ts`.

### Фаза 1 — Доменная модель + EF + миграции + сидинг ⏱ ~400–600k
- ~50 EF-сущностей (`IikoPos.Domain`) + enum (text+CHECK).
- `AppDbContext` + Fluent-конфигурации + query filters + составные ключи `(trade_point_id, id)`.
- EF Migration `001_init` (сверить с `migrations/001_init.sql`).
- Сидер из `mock/data.ts` + `mock/menu.ts` + `mock/warehouse.ts` (меню, склад, техкарты, справочники, корп-дерево, план счетов, права).
- `right_def` из `lib/rights.ts`, `role_right` из `POSITION_RIGHTS`.
- **DoD:** `dotnet ef database update` поднимает схему; сид заполняет ТП «Mumtaz»; данные читаются.

### Фаза 2 — Auth + RBAC ⏱ ~300–500k
- Вход касса: `POST /api/auth/pin {pin}`, `POST /api/auth/card {card}` → JWT (`sub, positions[], tp`) + refresh.
- Вход офис: `POST /api/auth/login {login,password}` (спроектировать — в моке нет).
- `RequireRightAttribute` / middleware → `hasRightIn(roleRights, positions, code)`.
- `GET /api/me`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Эндпоинт правки прав: `toggleRoleRight`.
- **DoD:** PIN 0000/1111 логинятся; эндпоинт без права отдаёт 403; матрица прав офиса меняется.

### Фаза 3 — CRUD config-справочников ⏱ ~600–900k
REST `GET/POST/PATCH/DELETE` + RBAC для: `staff`(+positions, `B_EE`), `payment_type`(`B_APT`), `order_type`, `cash_op_type`, `writeoff_reason`, `shift_type`, `discount`/`club_card`(`B_CUDS`), `loyalty_*`/`promo_action`/`certificate`/`deposit_program`(`F_APA`/офис), `motivation_program`/`pay_profile`/`med_check`/`shift_schedule`/`salary_deduction`, `contractor`(`B_SUPP`), `dish`/`menu_group`/`modifier_*`(`B_EN`), `tech_card_item`(`B_EAC`), `price_*`(`B_ROMENOR`), `license`/`print_template`/`input_device`(`B_ADM`), `delivery_settings`/`courier`/`delivery_customer`(`D_ED`), `corp_*`/`concept`/`doc_number`(`B_EC`), `establishment`, `hall`/`table`, `app_setting`(quick-menu/plan-fact/olap).
- **DoD:** каждый офисный экран-справочник читает/пишет через бэк.

### Фаза 4 — Горячий слой кассы (домен + транзакции) ⏱ ~1.0–1.5M
Эндпоинты-операции (см. таблицу §5.2 в DESIGN), мапятся на actions `pos.ts`:
- Смена: `shift/open`(`F_OCS`), `shift/close`(`F_CS`), `shift/report?x|z`.
- Заказы: `orders` CRUD + строки (addDish/inc/dec/qty/remove/guestNo/comment/course/kitchen/discount/waiter/type/tab/prepayment), `precheck`, `fiscalize`, **`pay`/`pay-guest`** (транзакция: closed_order+splits, списание по техкарте, fiscalSeq++, stop decrement, lock), `move/merge/forceClose`.
- Деньги/возврат: `cash/movements`(`F_CASH`), `refunds`(`F_STRN/F_SWWOFF`, restock), `payment-type`(`F_CHPAY`), `cashInDrawer`.
- Стоп-лист, банкеты, сообщения.
- **DoD:** полный флоу кассы открыть смену→заказ→оплата→возврат→закрытие смены работает на бэке; остатки склада и стоп-лист меняются авторитетно.

### Фаза 5 — Офисные операции ⏱ ~0.8–1.2M
- Закупки/ЭСФ: `addPurchase`(`B_INVC`, приход на склад + входящий ҚҚС), `addOutEsf`, `payInvoice`(`B_FIN`).
- Склад-документы: `createStoreDoc` (списание/приготовление/перемещение/инвентаризация), `receiveStock`, `setIngredientStock`, `resetStock`.
- Прейскурант: `createPriceOrder`/`activate`/`applyDue`, `setDishPrice`/`setCategoryPrice`/`setTechCard`.
- Зарплата: `paySalary` (изъятие из кассы + ведомость).
- Лояльность: `adjustBonus`/`topUpDeposit`/`adjustDeposit`/`redeem/voidCertificate`.
- Доставка: `createDeliveryOrder`/`setStatus`/`assignCourier`/`cancel`.
- Корпорация: `setCorpTree`/`requestSync`/`setDocTemplate`.
- Бухгалтерия: `addPosting`/`removePosting` (manual).
- **DoD:** офисные флоу (накладная→приход→проводки, инвентаризация, приказ цен→касса) работают.

### Фаза 6 — Отчёты (порт `lib/*` на сервер) ⏱ ~0.8–1.2M
Серверная авторитетная аналитика, эндпоинты `GET /api/reports/*`:
- `buildAutoPostings` → проводки (auto/opening не хранятся, генерятся).
- `stockMoves`/turnover/ingredientLedger → движение товара 605/606/615.
- `payables` → задолженность поставщикам.
- `pivot` → OLAP по продажам/проводкам, настраиваемые отчёты.
- P&L + `kzTax` (ОПВ/ВОСМС/ИПН/ОПВР/ООСМС/СО/СН 2026) + баланс/ДДС.
- X/Z-отчёты смены, отчёты по продажам/чаевым/питанию персонала.
- **DoD:** офисные отчёты сходятся с мок-расчётами (тесты-сверки).

### Фаза 7 — KZ-адаптеры ⏱ ~0.5M (мок) / +1–3M (реально)
- Интерфейс `IFiscalProvider` (Webkassa): `Fiscalize`, X/Z, ФН-ресурс, чек коррекции `F_CRCT`. Сначала **мок** (`fiscalSeq++`), потом реальный Webkassa.
- Интерфейс `IEsfProvider` (ИС ЭСФ): вх./исх. ЭСФ. Мок → реал esf.gov.kz.
- Экспорт в 1С (`B_EXC`).
- **DoD:** мок-провайдеры подключены; реальные — по доступу к sandbox.

### Фаза 8 — Тесты + харднинг ⏱ ~1.0M
- Порт `src/lib/*.test.ts` (money/ledger/stockMoves/payables/pivot/contractors/schedule/quickMenu) в xUnit.
- Интеграционные (WebApplicationFactory + Testcontainers PG): auth/RBAC 403, pay-транзакция, оверселл, возврат, закрытие смены.
- Конкурентность (двойная оплата/оверселл), индексы, нагрузка.
- **DoD:** зелёный CI, покрыты критические инварианты.

---

## Бюджет / риски
- **Контекст:** весь бэк (≈4–5M throughput) не помещается в одно окно 1M → работаем фазами, **коммит после каждой**, между фазами компакт.
- **Главный драйвер расхода — не объём кода (~250k вывода), а циклы build/test-fix.** Снижаем: вертикальные срезы (сущность→DTO→контроллер→тест→билд), а не «всё сразу».
- **Compat-слой (фаза 0) даёт результат немедленно** и стоит копейки — стартуем с него.

## Текущий статус
- [x] Дизайн модели — `BACKEND_DESIGN.md`
- [x] DDL — `migrations/000_compat.sql`, `migrations/001_init.sql`
- [x] План — этот файл
- [x] **Фаза 0 — ГОТОВО** (2026-06-14). Проект `../iiko-pos-backend/` (.NET 10 + EF Core 10 + Npgsql + PG16 в Docker). Solution (Api+Infrastructure) собирается чисто; compat-эндпоинты `config/:key` + `/runtime` + `/health` проверены curl (404→fallback, PUT/GET/DELETE 204/200, runtime персистится, кириллица ок). Фронт переключён на `httpRepository` (`iiko-pos/src/api/index.ts`) + `.env.local` (VITE_API_BASE=http://localhost:5080/api). Схема — raw bootstrap (Фаза 1 → EF migrations).
- [x] **Фаза 1 — ГОТОВО** (2026-06-14). Domain (~70 EF-сущностей, композитный ключ (TradePointId,Id) через [PrimaryKey], enum=string, decimal(18,4), списки→JSON-converter для переносимости). EF Migration `Init` (83 таблицы) применяется на старте; snake_case-конвенция; design-time фабрика. Сид ЯДРА из mock/* (меню 21, склад 31, техкарты 44, модификаторы+связи, штат+должности, зал 15, план счетов 11, корп-дерево, справочники РП, дисконт, контрагенты+2 накладные). Композитные FK проверены join'ом. Сборка чистая, ошибок нет.
- [ ] Фаза 1b (хвост сида) — полный каталог прав (rights.ts ~90 + POSITION_RIGHTS), лояльность/промо/сертификаты, доставка, лицензии/печ.формы/устройства, мотивация. Делать в Фазе 2/3 где потребляется.
- [x] **Фаза 2a — Ремодел схемы под мультиклиент — ГОТОВО** (2026-06-14). Добавлены `Tenant`/`AppUser`/`PlatformAdmin`; интерфейсы скоупа `ITenantScoped`(TenantId)/`IPointScoped`(+TradePointId); каталог (dish/ingredient-карточка/modifier/techcard/payment/order/discount/concept/account) → СЕТЬ; операционка+цены → ТОЧКА; остаток вынесен в `StockBalance(tenant,trade_point,warehouse,ingredient,qty,cost)`; ассортимент `PointDish`; `CorpPoint.TradePointId` — мост к скоупу. Миграция перегенерена (88 таблиц), сид: 1 tenant/3 ТП/каталог сети (dish21/ing31/techcard44) + точка (stock_balance31/staff4/invoice2). Кросс-скоуп join сеть↔точка считает себестоимость. Сборка чистая, compat жив.
- [x] **Фаза 2b — Auth + RBAC + онбординг — ГОТОВО** (2026-06-14, проверено вживую). JWT (claims kind/tenant_id/trade_point_id/uid/role/positions) + PBKDF2-хеш паролей; модель Employee(сеть)→EmployeeAssignment(PIN на точке, unique)→EmployeePosition; эндпоинты `/api/auth/{register,login,pin,card,platform-login}`, `/api/me`, `/api/platform/tenants`; RBAC `Rights` (порт POSITION_RIGHTS). Тест: PIN/карта/офис/платформа логинятся, платформа создаёт 2-ю сеть → её владелец входит (другой tenant_id), негативы 401. Осталось 2b-tail: full RightDef seed, EF query-filter по tenant, RequireRight на всех эндпоинтах.
- [x] **Изоляция + RBAC-энфорс — ГОТОВО** (2026-06-14, проверено). `CurrentTenant` из JWT + `RequireRight` (IEndpointFilter); первые защищённые эндпоинты `/api/catalog/{dishes,ingredients,stock}` с фильтром по tenant/point; демо RBAC `/api/pos/can-open-shift`(F_OCS), `/api/office/reports-ping`(B_RPT). Проверено: клиент видит только свою сеть (Mumtaz 21 / Burger 0), права рулят 200/403, без токена 401. Фикс: `MapInboundClaims=false`. TODO-харден: EF global query-filter (пока фильтрация явная в эндпоинтах).
- [~] (история) Фаза 2b — детали:
  - **Пользователи:** `AppUser` (офис: email/пароль/роль/скоуп сеть-или-ТП), `Staff` (POS: PIN/карта/ТП), PlatformAdmin.
  - **Онбординг (оба режима):** self-serve `POST /api/auth/register` (tenant+владелец) + создание клиента из платформенной админки; владелец заводит ТП → сотрудников.
  - **Auth:** JWT (claims tenant_id, trade_point_id?, user_id, positions[]) + refresh; вход PIN/карта (касса) и email/пароль (офис).
  - **RBAC:** `RequireRight`, query-filter по tenant_id (+trade_point_id); засев полного каталога прав.
- [ ] **Фаза 2-UI (фронт):** админка бэк-офиса для онбординга/управления — см. `ADMIN_BACKOFFICE_SPEC.md` (платформа: реестр клиентов; владелец: сеть/точки/сотрудники/каталог/цены по точкам).
- [x] **Фаза 4 (ядро кассы) — ЧАСТИЧНО ГОТОВО** (2026-06-14, проверено). Транзакционный happy-path: `POST /api/shift/{open,close}` + `/shift/current`; `POST /api/orders` (создать), `/orders/{id}/lines` (добавить блюдо+модификаторы), `GET /orders/{id}` (итог), **`POST /orders/{id}/pay`** — транзакция: ClosedOrder-снимок + payment_splits + списание StockBalance по техкарте (блюдо+модификаторы) + фискальный № (атомарный seq) + удаление открытого заказа. Чистые расчёты в Domain/PosCalc. Проверено curl: смена→заказ(18990₸)→оплата(сдача 1010, фискал 3681821001)→баранина 12→11.5. Атомарные счётчики через raw upsert RETURNING.
  - [x] Возврат + внесения/изъятия + ящик + X/Z — ГОТОВО (2026-06-14, проверено). `POST /api/refunds`(F_STRN, full/partial, restock возвращает ингредиенты), `POST/GET /api/cash/movements`(F_CASH), `GET /api/cash/drawer` (opening+нал.оплаты+внесения−изъятия−возвраты), `GET /api/shift/report?kind=x|z`(F_XR). Проверено: возврат чека restock баранина 11.5→12, ящик 16000, Z выручка↓/возвраты↑, официант изъятие 403.
  - Осталось в Фазе 4: пречек/фискализация-до-оплаты, оплата по гостям, стоп-лист декремент при оплате, цены по ценовой категории.
- [x] **Фаза 3 (CRUD справочников) — ЯДРО ГОТОВО** (2026-06-14, проверено). `Api/OfficeEndpoints.cs` (MapOffice): блюда CRUD [B_EN]; точки `GET/POST /api/office/points` [B_EC] (+авто юрлицо/подразделение для свежей сети, +Establishment); `GET /points/{id}/menu` (эффективная цена); `PUT /points/{id}/prices/{dishId}` [B_ROMENOR]; сотрудники `GET/POST /employees` [B_EE] + `POST /points/{id}/staff` (PIN+должности); склад `receive`[B_INVR]/`inventory`[B_PI]. Проверено: разные цены по точкам (капучино 1495/1800), PIN 1111 на точке2 пускает Сидорова (PIN per-point), CRUD блюда, касса→403.
  - Осталось в Ф3: остальные справочники (payment_types/order_types/discounts/cash_op_types/shift_types/contractors/modifiers/techcards-edit/корп-дерево CRUD/доставка/админ), маппинг офисного фронта на эти эндпоинты.
- [x] **Фаза 5 (закупки + бухгалтерия) — ЯДРО ГОТОВО** (2026-06-14, проверено). `Api/FinanceEndpoints.cs` (MapFinance): `POST /api/office/points/{id}/invoices` [B_INVC] (приход на склад + ҚҚС 16% в т.ч.), `GET .../invoices`, `POST .../invoices/{id}/pay` [B_FIN], `GET .../postings` [B_VCOA] (авто-проводки РК из фактов: продажи 1010/6010·6010/3130·7010/1330, закупки 1330/3310·1420/3310, ЗП/инкассация), `GET .../payables` [B_FIN] (задолженность). Себестоимость из StockBalance.Cost. Проверено: закупка 67500 (ҚҚС 9310), говядина 20→30, оплата → долг ↓, проводки сбалансированы. Грабля: invSeq стартовый seed=2 (накладные 1,2 засеяны) — счётчики точки засеяны в DbSeeder.
- [x] **Фаза 6 (отчёты) — ЯДРО ГОТОВО** (2026-06-14, проверено). `Api/ReportsEndpoints.cs` (MapReports) + `Domain/KzTax.cs`: `reports/sales` [B_CASR] (выручка/byDish/byPayment), `reports/balance` [B_VBALR] (ОСВ из проводок+сальдо, Σдт=Σкт), `reports/pnl` [B_RPT] (выручка-нетто/себест/валовая+ФОТ через kzTax), `payroll/tax?oklad=` [B_PAY] (ОПВ/ВОСМС/ИПН/СО/ОПВР/ООСМС/СН). `FinanceEndpoints.ComputePostings` вынесен в переиспользуемый. Проверено: баланс балансируется, P&L = проводкам, налоги по формулам.
- [ ] Фазы 7–8 — KZ-адаптеры (Webkassa/ЭСФ как интерфейсы-моки), тесты (порт lib/*.test), EF global query-filter харден.
- [ ] Хвосты 3/4/5 — остальные справочники, пречек/оплата-по-гостям/стоп-лист, движение товара/ДДС-отчёты; подключение офисного фронта к API.
