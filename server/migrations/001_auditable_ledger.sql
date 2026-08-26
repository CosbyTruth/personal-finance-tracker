CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(160) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  finance_account_id BIGINT REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  category_id BIGINT REFERENCES finance_categories(id) ON DELETE RESTRICT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  account_class VARCHAR(12) NOT NULL
    CHECK (account_class IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
  normal_side VARCHAR(6) NOT NULL CHECK (normal_side IN ('Debit', 'Credit')),
  currency CHAR(3),
  system_role VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, code),
  CHECK (
    (finance_account_id IS NOT NULL)::int
    + (category_id IS NOT NULL)::int
    + (system_role IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_finance_account
  ON ledger_accounts(user_id, finance_account_id)
  WHERE finance_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_category
  ON ledger_accounts(user_id, category_id)
  WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_system_role
  ON ledger_accounts(user_id, system_role)
  WHERE system_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_user_class
  ON ledger_accounts(user_id, account_class);

CREATE TABLE IF NOT EXISTS ledger_journals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_type VARCHAR(20) NOT NULL
    CHECK (journal_type IN ('Income', 'Expense', 'Transfer', 'OpeningBalance', 'Reversal')),
  occurred_on DATE NOT NULL,
  currency CHAR(3) NOT NULL,
  description VARCHAR(180) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status VARCHAR(10) NOT NULL DEFAULT 'Posted'
    CHECK (status IN ('Posted', 'Reversed')),
  idempotency_key VARCHAR(160),
  legacy_transaction_id BIGINT,
  reverses_journal_id BIGINT REFERENCES ledger_journals(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  UNIQUE (id, user_id),
  UNIQUE (reverses_journal_id),
  CHECK (
    (status = 'Reversed' AND reversed_at IS NOT NULL)
    OR (status = 'Posted' AND reversed_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_journals_idempotency
  ON ledger_journals(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_journals_active_legacy
  ON ledger_journals(user_id, legacy_transaction_id)
  WHERE legacy_transaction_id IS NOT NULL
    AND status = 'Posted'
    AND reverses_journal_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_journals_user_date
  ON ledger_journals(user_id, occurred_on DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_postings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_id BIGINT NOT NULL,
  ledger_account_id BIGINT NOT NULL,
  side VARCHAR(6) NOT NULL CHECK (side IN ('Debit', 'Credit')),
  amount NUMERIC(24,8) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (journal_id, user_id)
    REFERENCES ledger_journals(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (ledger_account_id, user_id)
    REFERENCES ledger_accounts(id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ledger_postings_journal
  ON ledger_postings(journal_id);
CREATE INDEX IF NOT EXISTS idx_ledger_postings_account
  ON ledger_postings(user_id, ledger_account_id, created_at DESC);

INSERT INTO ledger_accounts
  (user_id, finance_account_id, code, name, account_class, normal_side, currency)
SELECT a.user_id, a.id, 'ACCOUNT:' || a.id, a.name,
       CASE WHEN a.account_type = 'Credit' THEN 'Liability' ELSE 'Asset' END,
       CASE WHEN a.account_type = 'Credit' THEN 'Credit' ELSE 'Debit' END,
       a.currency
FROM finance_accounts a
ON CONFLICT DO NOTHING;

INSERT INTO ledger_accounts
  (user_id, category_id, code, name, account_class, normal_side)
SELECT c.user_id, c.id,
       CASE WHEN c.category_type = 'Income' THEN 'REVENUE:' ELSE 'EXPENSE:' END || c.id,
       c.name,
       CASE WHEN c.category_type = 'Income' THEN 'Revenue' ELSE 'Expense' END,
       CASE WHEN c.category_type = 'Income' THEN 'Credit' ELSE 'Debit' END
FROM finance_categories c
ON CONFLICT DO NOTHING;

INSERT INTO ledger_accounts
  (user_id, code, name, account_class, normal_side, system_role)
SELECT u.id, 'SYSTEM:OPENING_BALANCE', 'Opening balance equity', 'Equity', 'Credit', 'OpeningBalance'
FROM users u
ON CONFLICT DO NOTHING;

INSERT INTO ledger_journals
  (user_id, journal_type, occurred_on, currency, description, notes, idempotency_key)
SELECT a.user_id, 'OpeningBalance', a.created_at::date, a.currency,
       'Opening balance · ' || a.name, 'Imported from the original account balance',
       'opening:' || a.id
FROM finance_accounts a
WHERE a.opening_balance <> 0
ON CONFLICT DO NOTHING;

INSERT INTO ledger_postings
  (user_id, journal_id, ledger_account_id, side, amount, currency)
SELECT a.user_id, j.id, la.id,
       CASE WHEN a.opening_balance > 0 THEN 'Debit' ELSE 'Credit' END,
       ABS(a.opening_balance), a.currency
FROM finance_accounts a
JOIN ledger_journals j
  ON j.user_id=a.user_id AND j.idempotency_key='opening:' || a.id
JOIN ledger_accounts la
  ON la.user_id=a.user_id AND la.finance_account_id=a.id
WHERE a.opening_balance <> 0
  AND NOT EXISTS (
    SELECT 1 FROM ledger_postings p
    WHERE p.journal_id=j.id AND p.ledger_account_id=la.id
  );

INSERT INTO ledger_postings
  (user_id, journal_id, ledger_account_id, side, amount, currency)
SELECT a.user_id, j.id, equity.id,
       CASE WHEN a.opening_balance > 0 THEN 'Credit' ELSE 'Debit' END,
       ABS(a.opening_balance), a.currency
FROM finance_accounts a
JOIN ledger_journals j
  ON j.user_id=a.user_id AND j.idempotency_key='opening:' || a.id
JOIN ledger_accounts equity
  ON equity.user_id=a.user_id AND equity.system_role='OpeningBalance'
WHERE a.opening_balance <> 0
  AND NOT EXISTS (
    SELECT 1 FROM ledger_postings p
    WHERE p.journal_id=j.id AND p.ledger_account_id=equity.id
  );

INSERT INTO ledger_journals
  (user_id, journal_type, occurred_on, currency, description, notes, idempotency_key, legacy_transaction_id)
SELECT t.user_id, t.transaction_type, t.transaction_date, t.currency,
       t.description, t.notes, 'legacy:' || t.id, t.id
FROM finance_transactions t
ON CONFLICT DO NOTHING;

INSERT INTO ledger_postings
  (user_id, journal_id, ledger_account_id, side, amount, currency)
SELECT t.user_id, j.id,
       CASE
         WHEN t.transaction_type = 'Expense' THEN category_account.id
         WHEN t.transaction_type = 'Transfer' THEN destination_account.id
         ELSE source_account.id
       END,
       'Debit', t.amount, t.currency
FROM finance_transactions t
JOIN ledger_journals j
  ON j.user_id=t.user_id AND j.legacy_transaction_id=t.id
JOIN ledger_accounts source_account
  ON source_account.user_id=t.user_id AND source_account.finance_account_id=t.account_id
LEFT JOIN ledger_accounts destination_account
  ON destination_account.user_id=t.user_id AND destination_account.finance_account_id=t.transfer_account_id
LEFT JOIN ledger_accounts category_account
  ON category_account.user_id=t.user_id AND category_account.category_id=t.category_id
WHERE j.status='Posted'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_postings p WHERE p.journal_id=j.id
  );

INSERT INTO ledger_postings
  (user_id, journal_id, ledger_account_id, side, amount, currency)
SELECT t.user_id, j.id,
       CASE WHEN t.transaction_type = 'Income' THEN category_account.id ELSE source_account.id END,
       'Credit', t.amount, t.currency
FROM finance_transactions t
JOIN ledger_journals j
  ON j.user_id=t.user_id AND j.legacy_transaction_id=t.id
JOIN ledger_accounts source_account
  ON source_account.user_id=t.user_id AND source_account.finance_account_id=t.account_id
LEFT JOIN ledger_accounts category_account
  ON category_account.user_id=t.user_id AND category_account.category_id=t.category_id
WHERE j.status='Posted'
  AND (
    SELECT COUNT(*) FROM ledger_postings p WHERE p.journal_id=j.id
  ) = 1;

CREATE OR REPLACE FUNCTION validate_ledger_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_journal BIGINT;
  invalid_currency CHAR(3);
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_journal := OLD.journal_id;
  ELSE
    target_journal := NEW.journal_id;
  END IF;

  SELECT currency INTO invalid_currency
  FROM ledger_postings
  WHERE journal_id = target_journal
  GROUP BY currency
  HAVING COUNT(*) < 2
     OR SUM(amount) FILTER (WHERE side='Debit')
        IS DISTINCT FROM
        SUM(amount) FILTER (WHERE side='Credit')
  LIMIT 1;

  IF invalid_currency IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM ledger_postings WHERE journal_id=target_journal
  ) THEN
    RAISE EXCEPTION 'Ledger journal % is not balanced', target_journal
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION validate_ledger_journal_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_currency CHAR(3);
BEGIN
  SELECT currency INTO invalid_currency
  FROM ledger_postings
  WHERE journal_id = NEW.id
  GROUP BY currency
  HAVING COUNT(*) < 2
     OR SUM(amount) FILTER (WHERE side='Debit')
        IS DISTINCT FROM
        SUM(amount) FILTER (WHERE side='Credit')
  LIMIT 1;

  IF invalid_currency IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM ledger_postings WHERE journal_id=NEW.id
  ) THEN
    RAISE EXCEPTION 'Ledger journal % is not balanced', NEW.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ledger_journal_balance_guard ON ledger_postings;
CREATE CONSTRAINT TRIGGER ledger_journal_balance_guard
AFTER INSERT OR UPDATE OR DELETE ON ledger_postings
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_ledger_journal_balance();

DROP TRIGGER IF EXISTS ledger_journal_row_balance_guard ON ledger_journals;
CREATE CONSTRAINT TRIGGER ledger_journal_row_balance_guard
AFTER INSERT OR UPDATE ON ledger_journals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_ledger_journal_row();

CREATE OR REPLACE FUNCTION guard_ledger_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Ledger journals are immutable' USING ERRCODE='55000';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reverses_journal_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM ledger_journals
      WHERE id=NEW.reverses_journal_id AND user_id=NEW.user_id
    ) THEN
      RAISE EXCEPTION 'A reversal must reference a journal owned by the same user'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='Posted' AND NEW.status='Reversed'
     AND OLD.id=NEW.id AND OLD.user_id=NEW.user_id
     AND OLD.journal_type=NEW.journal_type AND OLD.occurred_on=NEW.occurred_on
     AND OLD.currency=NEW.currency AND OLD.description=NEW.description
     AND OLD.notes=NEW.notes
     AND OLD.created_at=NEW.created_at
     AND OLD.idempotency_key IS NOT DISTINCT FROM NEW.idempotency_key
     AND OLD.legacy_transaction_id IS NOT DISTINCT FROM NEW.legacy_transaction_id
     AND OLD.reverses_journal_id IS NOT DISTINCT FROM NEW.reverses_journal_id
     AND NEW.reversed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Ledger journals may only transition from Posted to Reversed'
    USING ERRCODE='55000';
END;
$$;

DROP TRIGGER IF EXISTS ledger_journals_immutable ON ledger_journals;
CREATE TRIGGER ledger_journals_immutable
BEFORE UPDATE OR DELETE ON ledger_journals
FOR EACH ROW EXECUTE FUNCTION guard_ledger_journal_mutation();

DROP TRIGGER IF EXISTS ledger_journal_insert_guard ON ledger_journals;
CREATE TRIGGER ledger_journal_insert_guard
BEFORE INSERT ON ledger_journals
FOR EACH ROW EXECUTE FUNCTION guard_ledger_journal_mutation();

CREATE OR REPLACE FUNCTION prevent_ledger_posting_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('kora.allow_ledger_mutation', TRUE) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Ledger postings are immutable; create a reversal journal instead'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS ledger_postings_immutable ON ledger_postings;
CREATE TRIGGER ledger_postings_immutable
BEFORE UPDATE OR DELETE ON ledger_postings
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_posting_mutation();

CREATE OR REPLACE VIEW ledger_account_balances AS
SELECT
  a.user_id,
  a.id AS ledger_account_id,
  a.finance_account_id,
  a.category_id,
  a.code,
  a.name,
  a.account_class,
  p.currency,
  SUM(CASE WHEN p.side='Debit' THEN p.amount ELSE -p.amount END)::numeric(24,8)
    AS debit_positive_balance
FROM ledger_accounts a
JOIN ledger_postings p
  ON p.ledger_account_id=a.id AND p.user_id=a.user_id
JOIN ledger_journals j
  ON j.id=p.journal_id AND j.user_id=p.user_id
GROUP BY a.user_id, a.id, p.currency;

COMMENT ON TABLE finance_transactions IS
  'Compatibility projection for the existing UI. ledger_journals and ledger_postings are the auditable source of truth.';
