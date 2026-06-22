-- 000_compat.sql — минимальная схема для запуска текущего фронта «за один день».
-- Реализует ровно PosRepository (config/:key + runtime). UI/стор не меняются.
-- Когда выкатите нормализованную схему (001_init.sql) — этот слой можно оставить как кэш
-- или заменить маппингом ключей на нормализованные таблицы.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- config/:key  (GET/PUT/DELETE /api/config/:key)
CREATE TABLE config_kv (
  trade_point_id uuid NOT NULL,
  key            text NOT NULL,
  value          jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trade_point_id, key)
);

-- runtime  (GET/PUT /api/runtime) — один снимок оперативного слоя на ТП
CREATE TABLE runtime_snapshot (
  trade_point_id uuid PRIMARY KEY,
  snapshot       jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
