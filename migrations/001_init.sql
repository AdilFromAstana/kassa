-- 001_init.sql — нормализованная схема iiko-POS (KZ) для PostgreSQL 16.
-- Имена полей 1:1 с src/types.ts (snake_case). Деньги numeric(14,2), кол-во numeric(14,3..4).
-- enum-поля = text + CHECK. Скоупинг: trade_point_id (ТП) / legal_id (юрлицо) — см. BACKEND_DESIGN.md §3.
-- Все scoped-таблицы фильтруются по trade_point_id в приложении (EF global query filter).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────── Корпорация / структура сети (модуль 02) ─────────────────────────
CREATE TABLE corp_legal (
  id   text PRIMARY KEY,
  name text NOT NULL,
  bin  text NOT NULL
);
CREATE TABLE corp_division (
  id       text PRIMARY KEY,
  legal_id text NOT NULL REFERENCES corp_legal(id) ON DELETE CASCADE,
  name     text NOT NULL
);
CREATE TABLE corp_point (              -- = торговое предприятие (ТП), якорь скоупинга
  id          text PRIMARY KEY,
  division_id text NOT NULL REFERENCES corp_division(id) ON DELETE CASCADE,
  name        text NOT NULL
);
CREATE TABLE corp_warehouse (
  id       text PRIMARY KEY,
  point_id text NOT NULL REFERENCES corp_point(id) ON DELETE CASCADE,
  name     text NOT NULL
);
CREATE INDEX ix_division_legal ON corp_division(legal_id);
CREATE INDEX ix_point_division ON corp_point(division_id);
CREATE INDEX ix_wh_point       ON corp_warehouse(point_id);

CREATE TABLE corp_settings (
  trade_point_id  uuid PRIMARY KEY,
  name            text NOT NULL,
  bin             text NOT NULL,
  currency        text NOT NULL,
  symbol          text NOT NULL,
  precision       int  NOT NULL DEFAULT 2,
  round_to_whole  boolean NOT NULL DEFAULT false
);

CREATE TABLE concept (                 -- глобальный
  id text PRIMARY KEY, code text NOT NULL, name text NOT NULL, "group" text NOT NULL
);
CREATE TABLE doc_number (
  trade_point_id uuid NOT NULL,
  id       text NOT NULL,
  doc_type text NOT NULL, template text NOT NULL, counter int NOT NULL DEFAULT 0,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE sync_point (
  trade_point_id uuid NOT NULL,
  id          text NOT NULL,
  point       text NOT NULL,
  last_import text, last_export text,
  status      text NOT NULL CHECK (status IN ('ok','requested','skipped','error')),
  PRIMARY KEY (trade_point_id, id)
);

-- ───────────────────────── Заведение (модуль 03) ─────────────────────────
CREATE TABLE establishment (
  trade_point_id        uuid PRIMARY KEY,
  name                  text NOT NULL,
  mode                  text NOT NULL CHECK (mode IN ('restaurant','fastfood')),
  precheck              boolean NOT NULL DEFAULT true,
  comments              boolean NOT NULL DEFAULT true,
  courses               boolean NOT NULL DEFAULT true,
  tab                   boolean NOT NULL DEFAULT false,
  mix                   boolean NOT NULL DEFAULT false,
  kitchen_screen        boolean NOT NULL DEFAULT true,
  banquets              boolean NOT NULL DEFAULT true,
  delivery              boolean NOT NULL DEFAULT true,
  iiko_card             boolean NOT NULL DEFAULT true,
  fiscal_before_pay     boolean NOT NULL DEFAULT false,
  fr_count              int  NOT NULL DEFAULT 1 CHECK (fr_count IN (1,2)),
  service_charge_active boolean NOT NULL DEFAULT false,
  service_charge_percent numeric(6,2) NOT NULL DEFAULT 0
);

-- ───────────────────────── Зал / столы ─────────────────────────
CREATE TABLE hall (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE restaurant_table (
  trade_point_id uuid NOT NULL,
  id      text NOT NULL,
  hall_id text NOT NULL,
  no      text NOT NULL, seats int NOT NULL, x int NOT NULL, y int NOT NULL,
  PRIMARY KEY (trade_point_id, id),
  FOREIGN KEY (trade_point_id, hall_id) REFERENCES hall(trade_point_id, id) ON DELETE CASCADE
);

-- ───────────────────────── Меню / прейскурант ─────────────────────────
CREATE TABLE menu_group (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, page int NOT NULL CHECK (page IN (1,2,3)),
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE dish (
  trade_point_id  uuid NOT NULL,
  id              text NOT NULL,
  name            text NOT NULL,
  code            text NOT NULL,
  price           numeric(14,2) NOT NULL,
  vat             int NOT NULL CHECK (vat IN (16,0)),
  group_id        text NOT NULL,
  color           text,
  is_weight       boolean,
  writeoff_method text CHECK (writeoff_method IN ('ingredients','finished')),
  PRIMARY KEY (trade_point_id, id),
  FOREIGN KEY (trade_point_id, group_id) REFERENCES menu_group(trade_point_id, id)
);
CREATE INDEX ix_dish_group ON dish(trade_point_id, group_id);
CREATE INDEX ix_dish_code  ON dish(trade_point_id, code);

CREATE TABLE modifier_group (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, min int NOT NULL, max int NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE modifier_option (
  trade_point_id uuid NOT NULL,
  id       text NOT NULL,
  group_id text NOT NULL,
  name     text NOT NULL, price numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (trade_point_id, id),
  FOREIGN KEY (trade_point_id, group_id) REFERENCES modifier_group(trade_point_id, id) ON DELETE CASCADE
);
CREATE TABLE dish_modifier_group (       -- N-N Dish.modifierGroupIds[]
  trade_point_id    uuid NOT NULL,
  dish_id           text NOT NULL,
  modifier_group_id text NOT NULL,
  PRIMARY KEY (trade_point_id, dish_id, modifier_group_id),
  FOREIGN KEY (trade_point_id, dish_id) REFERENCES dish(trade_point_id, id) ON DELETE CASCADE,
  FOREIGN KEY (trade_point_id, modifier_group_id) REFERENCES modifier_group(trade_point_id, id)
);

CREATE TABLE price_override (            -- iiko-menu-prices: dishId → ₸
  trade_point_id uuid NOT NULL,
  dish_id text NOT NULL,
  price   numeric(14,2) NOT NULL,
  PRIMARY KEY (trade_point_id, dish_id)
);
CREATE TABLE price_category (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE category_price (           -- iiko-category-prices: catId → dishId → ₸
  trade_point_id uuid NOT NULL,
  category_id text NOT NULL,
  dish_id     text NOT NULL,
  price       numeric(14,2) NOT NULL,
  PRIMARY KEY (trade_point_id, category_id, dish_id)
);
CREATE TABLE price_order (
  trade_point_id uuid NOT NULL,
  id         int NOT NULL,
  no         text NOT NULL,
  date       date NOT NULL,
  note       text NOT NULL DEFAULT '',
  status     text NOT NULL CHECK (status IN ('draft','active')),
  created_at text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE price_order_line (
  trade_point_id uuid NOT NULL,
  price_order_id int  NOT NULL,
  dish_id   text NOT NULL,
  name      text NOT NULL,
  old_price numeric(14,2) NOT NULL,
  new_price numeric(14,2) NOT NULL,
  FOREIGN KEY (trade_point_id, price_order_id) REFERENCES price_order(trade_point_id, id) ON DELETE CASCADE
);

-- ───────────────────────── Склад / техкарты (iikoOperation) ─────────────────────────
CREATE TABLE ingredient (
  trade_point_id uuid NOT NULL,
  id            text NOT NULL,
  code          text NOT NULL,
  name          text NOT NULL,
  unit          text NOT NULL CHECK (unit IN ('кг','л','шт')),
  stock         numeric(14,3) NOT NULL DEFAULT 0,
  cost_per_unit numeric(14,2) NOT NULL DEFAULT 0,
  min           numeric(14,3) NOT NULL DEFAULT 0,
  store         text,                     -- мок: метка склада; прод: → corp_warehouse (см. §9)
  xmin_guard    int NOT NULL DEFAULT 0,   -- опционально для оптимистичной блокировки списания
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE tech_card_item (             -- ТТК блюда (dishId → закладка)
  trade_point_id uuid NOT NULL,
  dish_id       text NOT NULL,
  ingredient_id text NOT NULL,
  gross         numeric(14,4) NOT NULL,
  cold_loss_pct numeric(6,2),
  hot_loss_pct  numeric(6,2),
  PRIMARY KEY (trade_point_id, dish_id, ingredient_id)
);
CREATE TABLE modifier_tech_card_item (    -- расход модификатора (optionId → закладка; gross может быть <0)
  trade_point_id uuid NOT NULL,
  option_id     text NOT NULL,
  ingredient_id text NOT NULL,
  gross         numeric(14,4) NOT NULL,
  PRIMARY KEY (trade_point_id, option_id, ingredient_id)
);

-- ───────────────────────── Справочники розничных продаж ─────────────────────────
CREATE TABLE payment_type (
  trade_point_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash','card','noRevenue','cashless','bonus')),
  active boolean, code text, open_drawer boolean, exact_sum boolean,
  print_receipt boolean, combinable boolean, discount_pct numeric(6,2),
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE order_type (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dinein','takeaway','delivery')),
  is_default boolean, vat int NOT NULL CHECK (vat IN (16,0)),
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE cash_op_type (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  require_comment boolean, "limit" numeric(14,2), manual boolean NOT NULL DEFAULT true,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE writeoff_reason (
  trade_point_id uuid NOT NULL, id text NOT NULL, name text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE shift_type (
  trade_point_id uuid NOT NULL, id text NOT NULL,
  name text NOT NULL, "from" text NOT NULL, "to" text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);

-- ───────────────────────── Сотрудники / права / зарплата ─────────────────────────
CREATE TABLE staff (
  trade_point_id uuid NOT NULL,
  id   text NOT NULL,
  name text NOT NULL,
  pin  text NOT NULL,
  card text,
  PRIMARY KEY (trade_point_id, id)
);
CREATE INDEX ix_staff_pin  ON staff(trade_point_id, pin);
CREATE INDEX ix_staff_card ON staff(trade_point_id, card);

CREATE TABLE staff_position (
  trade_point_id uuid NOT NULL,
  staff_id text NOT NULL,
  position text NOT NULL,
  PRIMARY KEY (trade_point_id, staff_id, position),
  FOREIGN KEY (trade_point_id, staff_id) REFERENCES staff(trade_point_id, id) ON DELETE CASCADE
);
CREATE TABLE right_def (                  -- глобальный справочник прав
  code  text PRIMARY KEY,
  name  text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('front','office','delivery'))
);
CREATE TABLE role_right (                 -- должность → право (правится в офисе)
  trade_point_id uuid NOT NULL,
  position   text NOT NULL,
  right_code text NOT NULL,
  PRIMARY KEY (trade_point_id, position, right_code)
);
CREATE TABLE pay_profile (
  trade_point_id uuid NOT NULL,
  staff_id text NOT NULL,
  mode  text CHECK (mode IN ('salary','hourly')),
  oklad numeric(14,2), rate numeric(14,2),
  PRIMARY KEY (trade_point_id, staff_id)
);
CREATE TABLE med_check (
  trade_point_id uuid NOT NULL, staff_id text NOT NULL, expiry date NOT NULL,
  PRIMARY KEY (trade_point_id, staff_id)
);
CREATE TABLE shift_schedule (
  trade_point_id uuid NOT NULL,
  staff_id text NOT NULL, date date NOT NULL, shift_type_id text NOT NULL,
  PRIMARY KEY (trade_point_id, staff_id, date)
);
CREATE TABLE salary_payout (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  staff_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('advance','settlement')),
  amount numeric(14,2) NOT NULL, at text NOT NULL, by text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE salary_deduction (
  trade_point_id uuid NOT NULL,
  id int NOT NULL, staff_id text NOT NULL,
  amount numeric(14,2) NOT NULL, reason text NOT NULL, at text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE motivation_program (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('all','dish','group')),
  target_id text,
  mode text NOT NULL CHECK (mode IN ('percent','perUnit')),
  value numeric(14,2) NOT NULL, min_qty numeric(14,3), active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (trade_point_id, id)
);

-- ───────────────────────── Дисконт / лояльность ─────────────────────────
CREATE TABLE discount (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, cheque_name text,
  kind text NOT NULL CHECK (kind IN ('discount','surcharge')),
  percent numeric(6,2) NOT NULL,
  manual boolean NOT NULL, by_card boolean NOT NULL, auto boolean NOT NULL,
  min_sum numeric(14,2), from_time text, to_time text,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE club_card (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, number text NOT NULL, owner text NOT NULL, discount_id text NOT NULL,
  PRIMARY KEY (trade_point_id, id),
  FOREIGN KEY (trade_point_id, discount_id) REFERENCES discount(trade_point_id, id)
);
CREATE TABLE loyalty_program  (trade_point_id uuid PRIMARY KEY, active boolean NOT NULL);
CREATE TABLE deposit_program  (trade_point_id uuid PRIMARY KEY, active boolean NOT NULL);
CREATE TABLE loyalty_card (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, number text NOT NULL, owner text NOT NULL, phone text NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT 0, deposit numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE promo_action (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL,
  type text NOT NULL CHECK (type IN ('accruePercent','accrueFixed','paymentLimit','welcome')),
  active boolean NOT NULL, percent numeric(6,2), amount numeric(14,2),
  min_sum numeric(14,2), group_id text,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE certificate (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, number text NOT NULL, nominal numeric(14,2) NOT NULL,
  issued_at date NOT NULL, expires_at date NOT NULL,
  status text NOT NULL CHECK (status IN ('active','used','expired')),
  owner text, used_at text,
  PRIMARY KEY (trade_point_id, id)
);

-- ───────────────────────── Контрагенты / накладные / бухгалтерия ─────────────────────────
CREATE TABLE contractor (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, bin text NOT NULL,
  PRIMARY KEY (trade_point_id, id),
  UNIQUE (trade_point_id, bin)
);
CREATE TABLE invoice (
  trade_point_id uuid NOT NULL,
  id            int NOT NULL,
  no            text NOT NULL,
  date          text NOT NULL,
  supplier_name text NOT NULL,
  supplier_bin  text NOT NULL,
  contractor_id text,                       -- §9 п.7: FK-снимок (опционально)
  total         numeric(14,2) NOT NULL,
  vat           numeric(14,2) NOT NULL,
  esf_no        text NOT NULL,
  kind          text CHECK (kind IN ('in','out')),
  store         text,
  paid          boolean NOT NULL DEFAULT false,   -- втянуто из iiko-invoice-paid (§9 п.1)
  due_date      date,                              -- §9 п.2 (опц.)
  PRIMARY KEY (trade_point_id, id)
);
CREATE INDEX ix_invoice_date ON invoice(trade_point_id, date);
CREATE TABLE invoice_line (
  trade_point_id uuid NOT NULL,
  invoice_id    int NOT NULL,
  ingredient_id text NOT NULL,
  name          text NOT NULL,
  qty           numeric(14,3) NOT NULL,
  price         numeric(14,2) NOT NULL,
  FOREIGN KEY (trade_point_id, invoice_id) REFERENCES invoice(trade_point_id, id) ON DELETE CASCADE
);
CREATE TABLE account (                      -- план счетов РК — глобальный
  code text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('A','P','I','E')),
  section text NOT NULL
);
CREATE TABLE opening_balance (              -- по юрлицу
  legal_id     text NOT NULL REFERENCES corp_legal(id) ON DELETE CASCADE,
  account_code text NOT NULL REFERENCES account(code),
  amount       numeric(14,2) NOT NULL,
  PRIMARY KEY (legal_id, account_code)
);
CREATE TABLE journal_entry (               -- хранятся только source='manual'; auto/opening генерируются
  trade_point_id uuid NOT NULL,
  id     text NOT NULL,
  date   text NOT NULL,
  debit  text NOT NULL REFERENCES account(code),
  credit text NOT NULL REFERENCES account(code),
  amount numeric(14,2) NOT NULL,
  "desc" text NOT NULL,
  source text NOT NULL CHECK (source IN ('opening','auto','manual')),
  PRIMARY KEY (trade_point_id, id)
);
CREATE INDEX ix_journal_date ON journal_entry(trade_point_id, date);

-- ───────────────────────── Доставка (модуль 14) ─────────────────────────
CREATE TABLE delivery_settings (
  trade_point_id uuid PRIMARY KEY,
  duration_min int NOT NULL, min_sum numeric(14,2) NOT NULL, fee_amount numeric(14,2) NOT NULL,
  cities text[] NOT NULL DEFAULT '{}', streets text[] NOT NULL DEFAULT '{}', districts text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE courier (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, on_shift boolean NOT NULL DEFAULT false,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE delivery_customer (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, phone text NOT NULL,
  street text NOT NULL, house text NOT NULL, apt text NOT NULL, district text NOT NULL,
  ad_source text NOT NULL, high_risk boolean NOT NULL DEFAULT false, comment text NOT NULL DEFAULT '',
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE delivery_order (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  no text NOT NULL,
  type text NOT NULL CHECK (type IN ('courier','pickup')),
  customer_name text NOT NULL, phone text NOT NULL, address text NOT NULL, ad_source text NOT NULL,
  goods numeric(14,2) NOT NULL, fee numeric(14,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('new','confirmed','cooking','onway','delivered','closed','cancelled')),
  courier_id text, created_at text NOT NULL, cancel_reason text,
  PRIMARY KEY (trade_point_id, id),
  FOREIGN KEY (trade_point_id, courier_id) REFERENCES courier(trade_point_id, id)
);
CREATE TABLE delivery_item (
  trade_point_id uuid NOT NULL,
  delivery_order_id int NOT NULL,
  name text NOT NULL, qty numeric(14,3) NOT NULL, price numeric(14,2) NOT NULL,
  FOREIGN KEY (trade_point_id, delivery_order_id) REFERENCES delivery_order(trade_point_id, id) ON DELETE CASCADE
);

-- ───────────────────────── Администрирование (модуль 12) ─────────────────────────
CREATE TABLE license (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, module text NOT NULL, count int NOT NULL, "from" date NOT NULL, "to" date NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE print_template (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, type text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('standard','custom')),
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE input_device (
  trade_point_id uuid NOT NULL,
  id text NOT NULL, name text NOT NULL, type text NOT NULL,
  "group" text NOT NULL CHECK ("group" IN ('keyboard','pos')),
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE app_setting (                  -- мелкие config-ключи: license-clientid, plan-fact, quick-menu, olap-reports
  trade_point_id uuid NOT NULL, key text NOT NULL, value jsonb NOT NULL,
  PRIMARY KEY (trade_point_id, key)
);

-- ═════════════════════════ ОПЕРАТИВНЫЙ СЛОЙ (runtime) ═════════════════════════
CREATE TABLE cash_shift (
  trade_point_id uuid NOT NULL,
  no int NOT NULL,
  opened_at text NOT NULL, opened_by text NOT NULL, closed_at text,
  opening_cash numeric(14,2),
  PRIMARY KEY (trade_point_id, no)
);
-- одна открытая смена на ТП:
CREATE UNIQUE INDEX ux_open_shift ON cash_shift(trade_point_id) WHERE closed_at IS NULL;

CREATE TABLE closed_shift (
  trade_point_id uuid NOT NULL,
  no int NOT NULL,
  opened_at text NOT NULL, closed_at text NOT NULL, revenue numeric(14,2) NOT NULL,
  PRIMARY KEY (trade_point_id, no)
);

CREATE TABLE "order" (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  table_id text, hall_id text,
  guests int NOT NULL, waiter text NOT NULL,
  type text NOT NULL CHECK (type IN ('dinein','takeaway','delivery')),
  discount_pct numeric(6,2) NOT NULL DEFAULT 0,
  surcharge_pct numeric(6,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2),
  service_charge_pct numeric(6,2),
  prepayment numeric(14,2),
  loyalty_card_id text,
  opened_at text NOT NULL,
  status text NOT NULL CHECK (status IN ('open','precheck','fiscalized','paid')),
  tab_name text,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE order_line (
  trade_point_id uuid NOT NULL,
  uid text NOT NULL,
  order_id int NOT NULL,
  dish_id text NOT NULL, name text NOT NULL,
  price numeric(14,2) NOT NULL, vat int NOT NULL CHECK (vat IN (16,0)),
  qty numeric(14,3) NOT NULL,
  guest_no int, comment text, course int,
  kitchen_status text CHECK (kitchen_status IN ('new','cooking','ready','served')),
  fired_at text, discount_pct numeric(6,2),
  PRIMARY KEY (trade_point_id, uid),
  FOREIGN KEY (trade_point_id, order_id) REFERENCES "order"(trade_point_id, id) ON DELETE CASCADE
);
CREATE TABLE order_line_modifier (
  trade_point_id uuid NOT NULL,
  order_line_uid text NOT NULL,
  option_id text NOT NULL, name text NOT NULL, price numeric(14,2) NOT NULL, qty numeric(14,3) NOT NULL,
  FOREIGN KEY (trade_point_id, order_line_uid) REFERENCES order_line(trade_point_id, uid) ON DELETE CASCADE
);

-- closed_order — снимок оплаченного чека (строки/модификаторы копируются)
CREATE TABLE closed_order (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  cash_shift_no int,                    -- NULL для текущей смены, заполняется при архивации
  table_id text, hall_id text,
  guests int NOT NULL, waiter text NOT NULL,
  type text NOT NULL CHECK (type IN ('dinein','takeaway','delivery')),
  discount_pct numeric(6,2) NOT NULL DEFAULT 0, surcharge_pct numeric(6,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2), service_charge_pct numeric(6,2),
  prepayment numeric(14,2), loyalty_card_id text,
  opened_at text NOT NULL, status text NOT NULL DEFAULT 'paid',
  tab_name text,
  paid_at text NOT NULL,
  change numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  fiscal_doc_no text NOT NULL,
  tip numeric(14,2), staff_meal boolean,
  PRIMARY KEY (trade_point_id, id)
);
CREATE UNIQUE INDEX ux_closed_fiscal ON closed_order(trade_point_id, fiscal_doc_no);  -- поиск для возврата
CREATE INDEX ix_closed_paid_at ON closed_order(trade_point_id, paid_at);
CREATE INDEX ix_closed_shift   ON closed_order(trade_point_id, cash_shift_no);

CREATE TABLE closed_order_line (
  trade_point_id uuid NOT NULL,
  uid text NOT NULL,
  closed_order_id int NOT NULL,
  dish_id text NOT NULL, name text NOT NULL,
  price numeric(14,2) NOT NULL, vat int NOT NULL, qty numeric(14,3) NOT NULL,
  guest_no int, comment text, course int, kitchen_status text, fired_at text, discount_pct numeric(6,2),
  PRIMARY KEY (trade_point_id, uid),
  FOREIGN KEY (trade_point_id, closed_order_id) REFERENCES closed_order(trade_point_id, id) ON DELETE CASCADE
);
CREATE TABLE closed_order_line_modifier (
  trade_point_id uuid NOT NULL,
  closed_order_line_uid text NOT NULL,
  option_id text NOT NULL, name text NOT NULL, price numeric(14,2) NOT NULL, qty numeric(14,3) NOT NULL,
  FOREIGN KEY (trade_point_id, closed_order_line_uid) REFERENCES closed_order_line(trade_point_id, uid) ON DELETE CASCADE
);
CREATE TABLE payment_split (
  trade_point_id uuid NOT NULL,
  closed_order_id int NOT NULL,
  payment_type_id text NOT NULL, name text NOT NULL, amount numeric(14,2) NOT NULL,
  FOREIGN KEY (trade_point_id, closed_order_id) REFERENCES closed_order(trade_point_id, id) ON DELETE CASCADE
);

CREATE TABLE cash_movement (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('in','out')),
  type text NOT NULL, amount numeric(14,2) NOT NULL, comment text NOT NULL DEFAULT '', at text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);
CREATE INDEX ix_cashmove_at ON cash_movement(trade_point_id, at);

CREATE TABLE refund (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  order_id int NOT NULL,
  fiscal_doc_no text NOT NULL,
  amount numeric(14,2) NOT NULL,
  full boolean NOT NULL,
  line_uids text[] NOT NULL DEFAULT '{}',
  qty_by_uid jsonb,
  reason text NOT NULL,
  restock boolean NOT NULL,
  method text NOT NULL CHECK (method IN ('cash','card')),
  at text NOT NULL, by text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);

CREATE TABLE write_off (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  dish_id text NOT NULL, name text NOT NULL, qty numeric(14,3) NOT NULL,
  reason text NOT NULL, cost numeric(14,2) NOT NULL, at text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);

CREATE TABLE store_doc (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  type text NOT NULL CHECK (type IN ('Акт списания','Акт приготовления','Акт переработки','Внутреннее перемещение','Расходная накладная','Возврат поставщику','Инвентаризация')),
  at text NOT NULL, by text NOT NULL, store text NOT NULL,
  to_store text, result text, reason text,
  PRIMARY KEY (trade_point_id, id)
);
CREATE TABLE store_doc_line (
  trade_point_id uuid NOT NULL,
  store_doc_id int NOT NULL,
  ingredient_id text NOT NULL, name text NOT NULL, unit text NOT NULL,
  qty numeric(14,3) NOT NULL, booked numeric(14,3),
  FOREIGN KEY (trade_point_id, store_doc_id) REFERENCES store_doc(trade_point_id, id) ON DELETE CASCADE
);

CREATE TABLE banquet (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  type text NOT NULL CHECK (type IN ('Банкет','Резерв')),
  status text NOT NULL CHECK (status IN ('Действует','Гость пришёл','Снят')),
  hall_id text NOT NULL, table_id text NOT NULL,
  date text NOT NULL, time text NOT NULL, guests int NOT NULL,
  client_name text NOT NULL, client_phone text NOT NULL, comment text NOT NULL DEFAULT '',
  prepayment numeric(14,2) NOT NULL DEFAULT 0, prepayment_method text, duration_min int,
  PRIMARY KEY (trade_point_id, id)
);

CREATE TABLE stop_item (
  trade_point_id uuid NOT NULL,
  id bigserial,
  dish_id text NOT NULL DEFAULT '',
  option_id text,
  name text,
  remaining numeric(14,3),
  scope text,
  by_name text NOT NULL,
  at text NOT NULL,
  PRIMARY KEY (trade_point_id, id)
);

CREATE TABLE message (
  trade_point_id uuid NOT NULL,
  id int NOT NULL,
  "from" text NOT NULL, date text NOT NULL, title text NOT NULL, body text NOT NULL,
  unread boolean NOT NULL DEFAULT true, important boolean, attachments jsonb, outgoing boolean,
  PRIMARY KEY (trade_point_id, id)
);

CREATE TABLE personal_shift (             -- §9 п.8: в моке не персистится
  trade_point_id uuid NOT NULL,
  staff_id text NOT NULL, position text NOT NULL, opened_at text NOT NULL,
  PRIMARY KEY (trade_point_id, staff_id)
);

-- Счётчики последовательностей (atomic UPDATE … RETURNING вместо клиентского +1)
CREATE TABLE seq_counter (
  trade_point_id uuid NOT NULL,
  name  text NOT NULL,   -- cashShiftSeq, orderSeq, fiscalSeq, docSeq, movementSeq, refundSeq, banquetSeq, invSeq, …
  value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (trade_point_id, name)
);
