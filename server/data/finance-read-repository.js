import { pool } from '../db.js'

export async function readAccountRows(userId, includeArchived = true, database = pool) {
  const result = await database.query(
    `SELECT a.id,a.name,a.account_type,a.currency,a.opening_balance,a.is_archived,a.created_at,a.updated_at,
       COUNT(t.id)::int AS transaction_count,
       (a.opening_balance + COALESCE(SUM(CASE
         WHEN t.transaction_type='Income' AND t.account_id=a.id THEN t.amount
         WHEN t.transaction_type='Expense' AND t.account_id=a.id THEN -t.amount
         WHEN t.transaction_type='Transfer' AND t.account_id=a.id THEN -t.amount
         WHEN t.transaction_type='Transfer' AND t.transfer_account_id=a.id THEN t.amount
         ELSE 0 END),0))::numeric(18,2) AS current_balance
     FROM finance_accounts a
     LEFT JOIN finance_transactions t
       ON t.user_id=a.user_id AND (t.account_id=a.id OR t.transfer_account_id=a.id)
     WHERE a.user_id=$1 AND ($2::boolean=TRUE OR a.is_archived=FALSE)
     GROUP BY a.id
     ORDER BY a.is_archived ASC, LOWER(a.name) ASC`,
    [userId, includeArchived],
  )
  return result.rows
}

export async function readBalanceSummary(userId, database = pool) {
  const result = await database.query(
    `WITH movements AS (
       SELECT account_id, CASE
         WHEN transaction_type='Income' THEN amount
         WHEN transaction_type='Expense' THEN -amount
         WHEN transaction_type='Transfer' THEN -amount ELSE 0 END AS delta
       FROM finance_transactions WHERE user_id=$1
       UNION ALL
       SELECT transfer_account_id, amount
       FROM finance_transactions
       WHERE user_id=$1 AND transaction_type='Transfer' AND transfer_account_id IS NOT NULL
     ), account_balances AS (
       SELECT a.currency,
         (a.opening_balance + COALESCE(SUM(m.delta),0))::numeric(18,2) AS current_balance
       FROM finance_accounts a
       LEFT JOIN movements m ON m.account_id=a.id
       WHERE a.user_id=$1
       GROUP BY a.id
     )
     SELECT currency,SUM(current_balance)::numeric(18,2) AS balance
     FROM account_balances GROUP BY currency ORDER BY currency`,
    [userId],
  )
  return result.rows
}

export async function readCategories(userId, database = pool) {
  const result = await database.query(
    `SELECT id,name,category_type,is_default,created_at
     FROM finance_categories
     WHERE user_id=$1
     ORDER BY category_type ASC,is_default DESC,LOWER(name) ASC`,
    [userId],
  )
  return result.rows
}

export async function readTransactionRows(userId, filters = {}, database = pool) {
  const params = [userId]
  const where = ['t.user_id = $1']
  if (filters.type) { params.push(filters.type); where.push(`t.transaction_type = $${params.length}`) }
  if (filters.accountId) { params.push(filters.accountId); where.push(`(t.account_id = $${params.length} OR t.transfer_account_id = $${params.length})`) }
  if (filters.categoryId) { params.push(filters.categoryId); where.push(`t.category_id = $${params.length}`) }
  if (filters.from) { params.push(filters.from); where.push(`t.transaction_date >= $${params.length}`) }
  if (filters.to) { params.push(filters.to); where.push(`t.transaction_date <= $${params.length}`) }
  if (filters.search) {
    params.push(`%${filters.search}%`)
    where.push(`(t.description ILIKE $${params.length} OR t.notes ILIKE $${params.length})`)
  }

  const result = await database.query(
    `SELECT t.id,t.transaction_type,t.account_id,t.category_id,t.transfer_account_id,
       t.amount,t.currency,t.description,t.notes,t.transaction_date,t.created_at,t.updated_at,
       a.name AS account_name,a.account_type,a.is_archived AS account_archived,
       c.name AS category_name,c.category_type,
       ta.name AS transfer_account_name,ta.account_type AS transfer_account_type,
       ta.is_archived AS transfer_account_archived,
       j.id AS journal_id,j.created_at AS ledger_posted_at,
       CASE WHEN j.id IS NULL THEN 'Legacy' ELSE 'Balanced' END AS ledger_status
     FROM finance_transactions t
     JOIN finance_accounts a ON a.id=t.account_id AND a.user_id=t.user_id
     LEFT JOIN finance_categories c ON c.id=t.category_id AND c.user_id=t.user_id
     LEFT JOIN finance_accounts ta ON ta.id=t.transfer_account_id AND ta.user_id=t.user_id
     LEFT JOIN ledger_journals j ON j.user_id=t.user_id AND j.legacy_transaction_id=t.id
       AND j.status='Posted' AND j.reverses_journal_id IS NULL
     WHERE ${where.join(' AND ')}
     ORDER BY t.transaction_date DESC,t.created_at DESC
     LIMIT 500`,
    params,
  )
  return result.rows
}

export async function readMonthlySummary(userId, database = pool) {
  const result = await database.query(
    `SELECT currency,
       COALESCE(SUM(CASE WHEN transaction_type='Income' THEN amount ELSE 0 END),0)::numeric(18,2) AS income,
       COALESCE(SUM(CASE WHEN transaction_type='Expense' THEN amount ELSE 0 END),0)::numeric(18,2) AS expenses,
       (COALESCE(SUM(CASE WHEN transaction_type='Income' THEN amount ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN transaction_type='Expense' THEN amount ELSE 0 END),0))::numeric(18,2) AS net_cash_flow,
       COUNT(*) FILTER (WHERE transaction_type IN ('Income','Expense'))::int AS cashflow_transactions,
       COUNT(*) FILTER (WHERE transaction_type='Transfer')::int AS transfers
     FROM finance_transactions
     WHERE user_id=$1
       AND transaction_date >= DATE_TRUNC('month',CURRENT_DATE)::date
       AND transaction_date < (DATE_TRUNC('month',CURRENT_DATE) + INTERVAL '1 month')::date
     GROUP BY currency ORDER BY currency`,
    [userId],
  )
  return result.rows
}
