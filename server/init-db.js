import 'dotenv/config'
import { pool } from './db.js'

if (!pool) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and configure PostgreSQL first.')
  process.exit(1)
}

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  account_type VARCHAR(20) NOT NULL
    CHECK (account_type IN ('Cash', 'Bank', 'Mobile Money', 'Savings', 'Investment', 'Credit', 'Other')),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  category_type VARCHAR(10) NOT NULL
    CHECK (category_type IN ('Income', 'Expense')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_categories_user_name_type
  ON finance_categories (user_id, LOWER(name), category_type);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  transaction_type VARCHAR(10) NOT NULL
    CHECK (transaction_type IN ('Income', 'Expense', 'Transfer')),
  category_id BIGINT REFERENCES finance_categories(id) ON DELETE RESTRICT,
  transfer_account_id BIGINT REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  description VARCHAR(180) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (transfer_account_id IS NULL OR account_id <> transfer_account_id),
  CHECK (
    (transaction_type = 'Transfer' AND category_id IS NULL AND transfer_account_id IS NOT NULL)
    OR
    (transaction_type IN ('Income', 'Expense') AND category_id IS NOT NULL AND transfer_account_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_user ON finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_categories_user ON finance_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_date ON finance_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON finance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON finance_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_transfer_account ON finance_transactions(transfer_account_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_type_date ON finance_transactions(user_id, transaction_type, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_currency_date ON finance_transactions(user_id, currency, transaction_date DESC);

CREATE TABLE IF NOT EXISTS finance_budgets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
  budget_month DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (EXTRACT(DAY FROM budget_month) = 1),
  UNIQUE (user_id, category_id, budget_month, currency)
);

CREATE INDEX IF NOT EXISTS idx_finance_budgets_user_month_currency
  ON finance_budgets(user_id, budget_month, currency);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_category ON finance_budgets(category_id);


CREATE TABLE IF NOT EXISTS finance_savings_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  goal_type VARCHAR(24) NOT NULL
    CHECK (goal_type IN ('Emergency Fund', 'Purchase', 'Travel', 'Business', 'Investment', 'Education', 'Other')),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  target_amount NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
  starting_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (starting_amount >= 0),
  target_date DATE,
  priority VARCHAR(10) NOT NULL DEFAULT 'Medium'
    CHECK (priority IN ('Low', 'Medium', 'High')),
  notes TEXT NOT NULL DEFAULT '',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_savings_goals_user_name
  ON finance_savings_goals (user_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_finance_savings_goals_user_archived
  ON finance_savings_goals(user_id, is_archived, target_date);

CREATE TABLE IF NOT EXISTS finance_goal_contributions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id BIGINT NOT NULL REFERENCES finance_savings_goals(id) ON DELETE CASCADE,
  entry_type VARCHAR(12) NOT NULL
    CHECK (entry_type IN ('Contribution', 'Withdrawal')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_goal_contributions_goal_date
  ON finance_goal_contributions(goal_id, contribution_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_goal_contributions_user
  ON finance_goal_contributions(user_id);


CREATE TABLE IF NOT EXISTS finance_recurring_items (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL
    CHECK (transaction_type IN ('Income', 'Expense')),
  account_id BIGINT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  category_id BIGINT NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  frequency VARCHAR(12) NOT NULL
    CHECK (frequency IN ('Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly')),
  next_due_date DATE NOT NULL,
  end_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR is_active = FALSE OR end_date >= next_due_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_recurring_items_user_due
  ON finance_recurring_items(user_id, is_active, next_due_date);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_items_account
  ON finance_recurring_items(account_id);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_items_category
  ON finance_recurring_items(category_id);

CREATE TABLE IF NOT EXISTS finance_recurring_occurrences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recurring_item_id BIGINT NOT NULL REFERENCES finance_recurring_items(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('Posted', 'Skipped')),
  transaction_id BIGINT REFERENCES finance_transactions(id) ON DELETE SET NULL,
  actual_amount NUMERIC(18,2),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'Posted' AND actual_amount IS NOT NULL AND actual_amount > 0)
    OR
    (status = 'Skipped' AND transaction_id IS NULL AND actual_amount IS NULL)
  ),
  UNIQUE (recurring_item_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_recurring_occurrences_user_date
  ON finance_recurring_occurrences(user_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_occurrences_item
  ON finance_recurring_occurrences(recurring_item_id, scheduled_date DESC);
`

try {
  await pool.query(sql)
  console.log('Database initialized: users, accounts, categories, transactions, budgets, savings goals, recurring cash flow and analytics/report indexes and smart-alert rules are ready.')
} catch (error) {
  console.error('Database initialization failed:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
