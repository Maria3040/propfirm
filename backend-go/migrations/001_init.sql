CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS challenges;
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS payouts;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS audithub;
CREATE SCHEMA IF NOT EXISTS competitions;

CREATE TABLE IF NOT EXISTS users.traders (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users.login_history (
  id VARCHAR(64) PRIMARY KEY,
  trader_id VARCHAR(64) NOT NULL,
  ip VARCHAR(64),
  country VARCHAR(120),
  country_code VARCHAR(8),
  city VARCHAR(120),
  isp VARCHAR(200),
  org VARCHAR(200),
  connection_kind VARCHAR(32),
  connection_label VARCHAR(120),
  is_vpn BOOLEAN DEFAULT FALSE,
  is_vps BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog.challenge_products (
  id VARCHAR(64) PRIMARY KEY,
  sku VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  phase_family VARCHAR(32) NOT NULL DEFAULT 'two_step',
  variant VARCHAR(32) NOT NULL DEFAULT 'flex',
  variant_tagline VARCHAR(120),
  account_size DOUBLE PRECISION NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  compare_price DOUBLE PRECISION,
  phases INT NOT NULL,
  profit_target_pct DOUBLE PRECISION NOT NULL,
  phase1_target_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  phase2_target_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_loss_pct DOUBLE PRECISION NOT NULL,
  max_loss_pct DOUBLE PRECISION NOT NULL,
  min_trading_days INT NOT NULL,
  profit_split_pct DOUBLE PRECISION NOT NULL DEFAULT 85,
  reward_cycle VARCHAR(64) NOT NULL DEFAULT 'Bi-Weekly',
  avg_first_reward DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_most_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS commerce.orders (
  id VARCHAR(64) PRIMARY KEY,
  trader_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  account_size DOUBLE PRECISION NOT NULL,
  phases INT NOT NULL,
  profit_target_pct DOUBLE PRECISION NOT NULL,
  phase1_target_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  phase2_target_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_loss_pct DOUBLE PRECISION NOT NULL,
  max_loss_pct DOUBLE PRECISION NOT NULL,
  min_trading_days INT NOT NULL,
  addon_swap_free BOOLEAN NOT NULL DEFAULT FALSE,
  platform VARCHAR(32) NOT NULL DEFAULT 'mt5',
  status VARCHAR(64) NOT NULL,
  payment_intent_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commerce.payment_intents (
  id VARCHAR(128) PRIMARY KEY,
  amount DOUBLE PRECISION NOT NULL,
  status VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS challenges.challenge_instances (
  id VARCHAR(64) PRIMARY KEY,
  trader_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL UNIQUE,
  product_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  account_size DOUBLE PRECISION NOT NULL,
  phases INT NOT NULL,
  current_phase INT NOT NULL,
  profit_target_pct DOUBLE PRECISION NOT NULL,
  phase1_target_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  phase2_target_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_loss_pct DOUBLE PRECISION NOT NULL,
  max_loss_pct DOUBLE PRECISION NOT NULL,
  min_trading_days INT NOT NULL,
  status VARCHAR(64) NOT NULL,
  fail_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trading.trading_accounts (
  id VARCHAR(64) PRIMARY KEY,
  challenge_id VARCHAR(64) NOT NULL UNIQUE,
  trader_id VARCHAR(64) NOT NULL,
  login VARCHAR(64) NOT NULL,
  password VARCHAR(128) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  server VARCHAR(128) NOT NULL,
  starting_balance DOUBLE PRECISION NOT NULL,
  equity DOUBLE PRECISION NOT NULL,
  high_water_mark DOUBLE PRECISION NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trading.trades (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  challenge_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  side VARCHAR(16) NOT NULL,
  lots DOUBLE PRECISION NOT NULL,
  pnl DOUBLE PRECISION NOT NULL,
  equity_after DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trading.equity_snapshots (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(64) NOT NULL,
  equity DOUBLE PRECISION NOT NULL,
  day_pnl DOUBLE PRECISION NOT NULL,
  trading_days INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS risk.breach_records (
  id VARCHAR(64) PRIMARY KEY,
  challenge_id VARCHAR(64) NOT NULL,
  rule VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts.trader_wallets (
  trader_id VARCHAR(64) PRIMARY KEY,
  available_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts.payout_requests (
  id VARCHAR(64) PRIMARY KEY,
  trader_id VARCHAR(64) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status VARCHAR(64) NOT NULL,
  challenge_id VARCHAR(64),
  method VARCHAR(64),
  reward_type VARCHAR(64),
  crypto_network VARCHAR(64),
  crypto_address VARCHAR(256),
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications.notification_messages (
  id VARCHAR(64) PRIMARY KEY,
  to_email VARCHAR(200) NOT NULL,
  subject VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  delivery_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audithub.audit_entries (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  source VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS competitions.competition_joins (
  id VARCHAR(64) PRIMARY KEY,
  trader_id VARCHAR(64) NOT NULL,
  competition_id VARCHAR(64) NOT NULL,
  competition_title VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (trader_id, competition_id)
);
