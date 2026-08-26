import express from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  createLedgerTransaction,
  createFinancialAccount,
  createTransaction,
  LedgerDataError,
  removeTransaction,
  replaceFinancialAccount,
  replaceTransaction,
} from '../data/ledger-repository.js'
import { withTransaction } from '../data/transaction-manager.js'
import { advanceRecurringDate, recurringOccurrencesInRange } from '../domain/recurrence.js'
import {
  readAccountRows,
  readBalanceSummary,
  readCategories,
  readMonthlySummary,
  readTransactionRows,
} from '../data/finance-read-repository.js'

const router = express.Router()
router.use(requireAuth)

const ACCOUNT_TYPES = new Set(['Cash', 'Bank', 'Mobile Money', 'Savings', 'Investment', 'Credit', 'Other'])
const TRANSACTION_TYPES = new Set(['Income', 'Expense', 'Transfer'])
const CATEGORY_TYPES = new Set(['Income', 'Expense'])
const GOAL_TYPES = new Set(['Emergency Fund', 'Purchase', 'Travel', 'Business', 'Investment', 'Education', 'Other'])
const GOAL_PRIORITIES = new Set(['Low', 'Medium', 'High'])
const GOAL_ENTRY_TYPES = new Set(['Contribution', 'Withdrawal'])
const RECURRING_FREQUENCIES = new Set(['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly'])

function cleanName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanCurrency(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function normalizeMoney(value, { allowNegative = true } = {}) {
  const raw = String(value ?? '').trim()
  const pattern = allowNegative ? /^-?\d{1,15}(\.\d{1,2})?$/ : /^\d{1,15}(\.\d{1,2})?$/
  if (!pattern.test(raw)) return null
  if (!allowNegative && Number(raw) <= 0) return null
  return raw
}

function normalizeNonNegativeMoney(value) {
  const raw = String(value ?? '').trim()
  if (!/^\d{1,15}(\.\d{1,2})?$/.test(raw)) return null
  return raw
}

function normalizeId(value) {
  const raw = String(value ?? '').trim()
  return /^\d+$/.test(raw) ? raw : null
}

function normalizeDate(value, { optional = false } = {}) {
  const raw = String(value ?? '').trim()
  if (!raw && optional) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return null
  return raw
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function validateAccountInput(body) {
  const name = cleanName(body.name)
  const accountType = body.accountType
  const currency = cleanCurrency(body.currency || 'GHS')
  const openingBalance = normalizeMoney(body.openingBalance ?? '0')

  if (!name || name.length > 80) return { error: 'Account name must be between 1 and 80 characters.' }
  if (!ACCOUNT_TYPES.has(accountType)) return { error: 'Choose a valid account type.' }
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Currency must be a three-letter code such as GHS or USD.' }
  if (openingBalance === null) return { error: 'Opening balance must be a valid amount with no more than two decimal places.' }

  return { value: { name, accountType, currency, openingBalance } }
}

function validateTransactionInput(body) {
  const transactionType = cleanName(body.transactionType)
  const accountId = normalizeId(body.accountId)
  const categoryId = body.categoryId === null || body.categoryId === '' || body.categoryId === undefined
    ? null
    : normalizeId(body.categoryId)
  const transferAccountId = body.transferAccountId === null || body.transferAccountId === '' || body.transferAccountId === undefined
    ? null
    : normalizeId(body.transferAccountId)
  const amount = normalizeMoney(body.amount, { allowNegative: false })
  const description = cleanText(body.description, 180)
  const notes = cleanText(body.notes, 2000)
  const transactionDate = normalizeDate(body.transactionDate || todayIso())

  if (!TRANSACTION_TYPES.has(transactionType)) return { error: 'Choose Income, Expense or Transfer.' }
  if (!accountId) return { error: 'Choose an account.' }
  if (!amount) return { error: 'Amount must be greater than zero and have no more than two decimal places.' }
  if (!transactionDate) return { error: 'Enter a valid transaction date.' }

  if (transactionType === 'Transfer') {
    if (!transferAccountId) return { error: 'Choose the destination account for this transfer.' }
    if (transferAccountId === accountId) return { error: 'A transfer must use two different accounts.' }
    if (categoryId) return { error: 'Transfers do not use income or expense categories.' }
  } else {
    if (!categoryId) return { error: `Choose an ${transactionType.toLowerCase()} category.` }
    if (transferAccountId) return { error: 'Only transfers can have a destination account.' }
  }

  return {
    value: {
      transactionType,
      accountId,
      categoryId,
      transferAccountId,
      amount,
      description,
      notes,
      transactionDate,
    },
  }
}

async function getAccountRows(userId, includeArchived = true) {
  return readAccountRows(userId, includeArchived)
}

async function getBalanceSummary(userId) {
  return readBalanceSummary(userId)
}

async function getCategories(userId) {
  return readCategories(userId)
}

async function loadOwnedAccount(userId, accountId, { activeOnly = false } = {}) {
  const result = await pool.query(
    `SELECT id, name, account_type, currency, opening_balance, is_archived
     FROM finance_accounts
     WHERE id = $1 AND user_id = $2 ${activeOnly ? 'AND is_archived = FALSE' : ''}
     LIMIT 1`,
    [accountId, userId],
  )
  return result.rows[0] || null
}

function mapTransactionFilters(query) {
  const filters = {
    type: cleanName(query.type || ''),
    accountId: normalizeId(query.accountId),
    categoryId: normalizeId(query.categoryId),
    from: normalizeDate(query.from, { optional: true }),
    to: normalizeDate(query.to, { optional: true }),
    search: cleanText(query.search, 100),
  }

  if (filters.type && !TRANSACTION_TYPES.has(filters.type)) filters.type = ''
  return filters
}

async function getTransactionRows(userId, query = {}) {
  return readTransactionRows(userId, mapTransactionFilters(query))
}

async function getMonthlySummary(userId) {
  return readMonthlySummary(userId)
}

router.get('/foundation', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })

  try {
    const accounts = await getAccountRows(req.auth.userId, true)
    const balances = await getBalanceSummary(req.auth.userId)
    const monthly = await getMonthlySummary(req.auth.userId)
    const countResult = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM finance_categories WHERE user_id = $1) AS categories,
        (SELECT COUNT(*)::int FROM finance_transactions WHERE user_id = $1) AS transactions`,
      [req.auth.userId],
    )

    return res.json({
      accounts: accounts.length,
      activeAccounts: accounts.filter((account) => !account.is_archived).length,
      archivedAccounts: accounts.filter((account) => account.is_archived).length,
      ...countResult.rows[0],
      balances,
      monthly,
      defaultCurrency: 'GHS',
      ledgerVersion: 1,
      ready: true,
    })
  } catch (error) {
    console.error('Finance foundation lookup failed:', error)
    return res.status(500).json({ message: 'Could not load finance foundation' })
  }
})

router.get('/accounts', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })

  try {
    const accounts = await getAccountRows(req.auth.userId, true)
    const balances = await getBalanceSummary(req.auth.userId)
    return res.json({
      accounts,
      balances,
      activeCount: accounts.filter((account) => !account.is_archived).length,
      archivedCount: accounts.filter((account) => account.is_archived).length,
    })
  } catch (error) {
    console.error('Account list failed:', error)
    return res.status(500).json({ message: 'Could not load accounts' })
  }
})

router.post('/accounts', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })

  const validation = validateAccountInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  const { name, accountType, currency, openingBalance } = validation.value

  try {
    const result = await createFinancialAccount({
      userId: req.auth.userId,
      account: { name, accountType, currency, openingBalance },
    })
    return res.status(201).json({ account: { ...result, current_balance: result.opening_balance, transaction_count: 0 } })
  } catch (error) {
    if (error instanceof LedgerDataError) return res.status(error.status).json({ message: error.message, code: error.code })
    if (error.code === '23505') return res.status(409).json({ message: 'An account with this name already exists.' })
    console.error('Account creation failed:', error)
    return res.status(500).json({ message: 'Could not create account' })
  }
})

router.put('/accounts/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })

  const validation = validateAccountInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })
  const { name, accountType, currency, openingBalance } = validation.value

  try {
    await replaceFinancialAccount({
      userId: req.auth.userId,
      accountId: req.params.id,
      account: { name, accountType, currency, openingBalance },
    })

    const accounts = await getAccountRows(req.auth.userId, true)
    const account = accounts.find((item) => String(item.id) === String(req.params.id))
    return res.json({ account })
  } catch (error) {
    if (error instanceof LedgerDataError) return res.status(error.status).json({ message: error.message, code: error.code })
    if (error.code === '23505') return res.status(409).json({ message: 'Another account already uses this name.' })
    console.error('Account update failed:', error)
    return res.status(500).json({ message: 'Could not update account' })
  }
})

router.post('/accounts/:id/archive', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })

  try {
    await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE finance_accounts
         SET is_archived=TRUE, updated_at=NOW()
         WHERE id=$1 AND user_id=$2 AND is_archived=FALSE
         RETURNING id`,
        [req.params.id, req.auth.userId],
      )
      if (!result.rowCount) throw new LedgerDataError('Active account not found.', 404, 'NOT_FOUND')
      await client.query(
        `UPDATE finance_recurring_items SET is_active=FALSE, updated_at=NOW()
         WHERE user_id=$1 AND account_id=$2 AND is_active=TRUE`,
        [req.auth.userId, req.params.id],
      )
    })
    return res.json({ ok: true })
  } catch (error) {
    if (error instanceof LedgerDataError) return res.status(error.status).json({ message: error.message, code: error.code })
    console.error('Account archive failed:', error)
    return res.status(500).json({ message: 'Could not archive account' })
  }
})

router.post('/accounts/:id/restore', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })

  try {
    const result = await pool.query(
      `UPDATE finance_accounts
       SET is_archived = FALSE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_archived = TRUE
       RETURNING id`,
      [req.params.id, req.auth.userId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Archived account not found' })
    return res.json({ ok: true })
  } catch (error) {
    console.error('Account restore failed:', error)
    return res.status(500).json({ message: 'Could not restore account' })
  }
})

router.get('/categories', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    return res.json({ categories: await getCategories(req.auth.userId) })
  } catch (error) {
    console.error('Category list failed:', error)
    return res.status(500).json({ message: 'Could not load categories' })
  }
})

router.post('/categories', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const name = cleanName(req.body?.name)
  const categoryType = cleanName(req.body?.categoryType)
  if (!name || name.length > 80) return res.status(400).json({ message: 'Category name must be between 1 and 80 characters.' })
  if (!CATEGORY_TYPES.has(categoryType)) return res.status(400).json({ message: 'Choose Income or Expense for the category type.' })

  try {
    const result = await pool.query(
      `INSERT INTO finance_categories (user_id, name, category_type, is_default)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, name, category_type, is_default, created_at`,
      [req.auth.userId, name, categoryType],
    )
    return res.status(201).json({ category: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'That category already exists for this transaction type.' })
    console.error('Category creation failed:', error)
    return res.status(500).json({ message: 'Could not create category' })
  }
})

router.delete('/categories/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const categoryResult = await pool.query(
      `SELECT id, is_default FROM finance_categories WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.auth.userId],
    )
    if (!categoryResult.rowCount) return res.status(404).json({ message: 'Category not found' })
    if (categoryResult.rows[0].is_default) return res.status(409).json({ message: 'Default categories cannot be deleted.' })

    const used = await pool.query(
      `SELECT 1 FROM finance_transactions WHERE user_id = $1 AND category_id = $2
       UNION ALL
       SELECT 1 FROM finance_recurring_items WHERE user_id = $1 AND category_id = $2
       LIMIT 1`,
      [req.auth.userId, req.params.id],
    )
    if (used.rowCount) return res.status(409).json({ message: 'This category is used by transaction or recurring history and cannot be deleted.' })

    await pool.query(`DELETE FROM finance_categories WHERE id = $1 AND user_id = $2`, [req.params.id, req.auth.userId])
    return res.status(204).end()
  } catch (error) {
    console.error('Category deletion failed:', error)
    return res.status(500).json({ message: 'Could not delete category' })
  }
})

router.get('/transactions', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const [transactions, accounts, categories, monthly] = await Promise.all([
      getTransactionRows(req.auth.userId, req.query),
      getAccountRows(req.auth.userId, true),
      getCategories(req.auth.userId),
      getMonthlySummary(req.auth.userId),
    ])
    return res.json({ transactions, accounts, categories, monthly })
  } catch (error) {
    console.error('Transaction list failed:', error)
    return res.status(500).json({ message: 'Could not load transactions' })
  }
})

router.get('/transactions/summary', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const [monthly, balances, recent] = await Promise.all([
      getMonthlySummary(req.auth.userId),
      getBalanceSummary(req.auth.userId),
      getTransactionRows(req.auth.userId, {}),
    ])
    return res.json({ monthly, balances, recent: recent.slice(0, 6) })
  } catch (error) {
    console.error('Transaction summary failed:', error)
    return res.status(500).json({ message: 'Could not load transaction summary' })
  }
})

router.post('/transactions', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateTransactionInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const rawKey = String(req.get('Idempotency-Key') || '').trim()
    if (rawKey && !/^[A-Za-z0-9:_./-]{1,160}$/.test(rawKey)) {
      return res.status(400).json({ message: 'Idempotency-Key contains unsupported characters.' })
    }
    const result = await createTransaction({
      userId: req.auth.userId,
      transaction: validation.value,
      idempotencyKey: rawKey || null,
    })

    const rows = await getTransactionRows(req.auth.userId, {})
    const created = rows.find((row) => String(row.id) === String(result.id))
    return res.status(result.replayed ? 200 : 201).json({ transaction: created, replayed: result.replayed })
  } catch (error) {
    if (error instanceof LedgerDataError) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: 'This transaction request has already been processed.' })
    }
    console.error('Transaction creation failed:', error)
    return res.status(500).json({ message: 'Could not create transaction' })
  }
})

router.put('/transactions/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateTransactionInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    await replaceTransaction({
      userId: req.auth.userId,
      transactionId: req.params.id,
      transaction: validation.value,
    })

    const rows = await getTransactionRows(req.auth.userId, {})
    const updated = rows.find((row) => String(row.id) === String(req.params.id))
    return res.json({ transaction: updated })
  } catch (error) {
    if (error instanceof LedgerDataError) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.error('Transaction update failed:', error)
    return res.status(500).json({ message: 'Could not update transaction' })
  }
})

router.delete('/transactions/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    await removeTransaction({ userId: req.auth.userId, transactionId: req.params.id })
    return res.status(204).end()
  } catch (error) {
    if (error instanceof LedgerDataError) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.error('Transaction deletion failed:', error)
    return res.status(500).json({ message: 'Could not delete transaction' })
  }
})


function normalizeBudgetMonth(value) {
  const raw = String(value || '').trim()
  const candidate = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw
  if (!/^\d{4}-\d{2}-01$/.test(candidate)) return null
  const parsed = new Date(`${candidate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) return null
  return candidate
}

function currentBudgetMonth() {
  return `${todayIso().slice(0, 7)}-01`
}

function validateBudgetInput(body) {
  const categoryId = normalizeId(body.categoryId)
  const amount = normalizeMoney(body.amount, { allowNegative: false })
  const currency = cleanCurrency(body.currency || 'GHS')
  const budgetMonth = normalizeBudgetMonth(body.budgetMonth || currentBudgetMonth())

  if (!categoryId) return { error: 'Choose an expense category.' }
  if (!amount) return { error: 'Budget amount must be greater than zero and have no more than two decimal places.' }
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Currency must be a three-letter code such as GHS or USD.' }
  if (!budgetMonth) return { error: 'Choose a valid budget month.' }

  return { value: { categoryId, amount, currency, budgetMonth } }
}

async function loadExpenseCategory(userId, categoryId) {
  const result = await pool.query(
    `SELECT id, name, category_type
     FROM finance_categories
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [categoryId, userId],
  )
  const category = result.rows[0] || null
  if (!category || category.category_type !== 'Expense') return null
  return category
}

async function getBudgetOverview(userId, monthInput, currencyInput) {
  const budgetMonth = normalizeBudgetMonth(monthInput || currentBudgetMonth())
  const currency = cleanCurrency(currencyInput || 'GHS')
  if (!budgetMonth) throw new Error('INVALID_BUDGET_MONTH')
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_CURRENCY')

  const budgetsResult = await pool.query(
    `SELECT
       b.id,
       b.category_id,
       c.name AS category_name,
       b.budget_month,
       b.currency,
       b.amount,
       COALESCE(SUM(t.amount), 0)::numeric(18,2) AS spent,
       (b.amount - COALESCE(SUM(t.amount), 0))::numeric(18,2) AS remaining,
       CASE
         WHEN b.amount > 0 THEN ROUND((COALESCE(SUM(t.amount), 0) / b.amount) * 100, 1)
         ELSE 0
       END AS percent_used,
       b.created_at,
       b.updated_at
     FROM finance_budgets b
     JOIN finance_categories c
       ON c.id = b.category_id AND c.user_id = b.user_id
     LEFT JOIN finance_transactions t
       ON t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.transaction_type = 'Expense'
      AND t.currency = b.currency
      AND t.transaction_date >= b.budget_month
      AND t.transaction_date < (b.budget_month + INTERVAL '1 month')::date
     WHERE b.user_id = $1
       AND b.budget_month = $2::date
       AND b.currency = $3
     GROUP BY b.id, c.name
     ORDER BY percent_used DESC, LOWER(c.name) ASC`,
    [userId, budgetMonth, currency],
  )

  const spendingResult = await pool.query(
    `SELECT
       c.id AS category_id,
       c.name AS category_name,
       COALESCE(SUM(t.amount), 0)::numeric(18,2) AS spent
     FROM finance_transactions t
     JOIN finance_categories c
       ON c.id = t.category_id AND c.user_id = t.user_id
     WHERE t.user_id = $1
       AND t.transaction_type = 'Expense'
       AND t.currency = $3
       AND t.transaction_date >= $2::date
       AND t.transaction_date < ($2::date + INTERVAL '1 month')::date
       AND NOT EXISTS (
         SELECT 1
         FROM finance_budgets b
         WHERE b.user_id = t.user_id
           AND b.category_id = t.category_id
           AND b.budget_month = $2::date
           AND b.currency = $3
       )
     GROUP BY c.id, c.name
     HAVING SUM(t.amount) > 0
     ORDER BY SUM(t.amount) DESC, LOWER(c.name) ASC`,
    [userId, budgetMonth, currency],
  )

  const expensesResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric(18,2) AS total_expenses
     FROM finance_transactions
     WHERE user_id = $1
       AND transaction_type = 'Expense'
       AND currency = $3
       AND transaction_date >= $2::date
       AND transaction_date < ($2::date + INTERVAL '1 month')::date`,
    [userId, budgetMonth, currency],
  )

  const categories = (await getCategories(userId)).filter((category) => category.category_type === 'Expense')
  const budgets = budgetsResult.rows
  const totalBudget = budgets.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const totalExpenses = Number(expensesResult.rows[0]?.total_expenses || 0)
  const budgetedSpent = budgets.reduce((sum, row) => sum + Number(row.spent || 0), 0)
  const unbudgetedSpent = spendingResult.rows.reduce((sum, row) => sum + Number(row.spent || 0), 0)
  const remaining = totalBudget - totalExpenses
  const percentUsed = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0

  return {
    month: budgetMonth.slice(0, 7),
    budgetMonth,
    currency,
    budgets,
    categories,
    unbudgeted: spendingResult.rows,
    summary: {
      totalBudget: totalBudget.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      budgetedSpent: budgetedSpent.toFixed(2),
      unbudgetedSpent: unbudgetedSpent.toFixed(2),
      remaining: remaining.toFixed(2),
      percentUsed: Number(percentUsed.toFixed(1)),
      budgetCount: budgets.length,
    },
  }
}

router.get('/budgets', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const data = await getBudgetOverview(req.auth.userId, req.query.month, req.query.currency)
    return res.json(data)
  } catch (error) {
    if (error.message === 'INVALID_BUDGET_MONTH') return res.status(400).json({ message: 'Use a valid month in YYYY-MM format.' })
    if (error.message === 'INVALID_CURRENCY') return res.status(400).json({ message: 'Use a valid three-letter currency code.' })
    console.error('Budget overview failed:', error)
    return res.status(500).json({ message: 'Could not load budgets' })
  }
})

router.post('/budgets', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateBudgetInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const budget = validation.value
    const category = await loadExpenseCategory(req.auth.userId, budget.categoryId)
    if (!category) return res.status(400).json({ message: 'Budgets can only be created for your expense categories.' })

    const result = await pool.query(
      `INSERT INTO finance_budgets (user_id, category_id, budget_month, currency, amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.auth.userId, budget.categoryId, budget.budgetMonth, budget.currency, budget.amount],
    )
    const overview = await getBudgetOverview(req.auth.userId, budget.budgetMonth, budget.currency)
    const created = overview.budgets.find((row) => String(row.id) === String(result.rows[0].id))
    return res.status(201).json({ budget: created, summary: overview.summary })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'This category already has a budget for that month and currency.' })
    console.error('Budget creation failed:', error)
    return res.status(500).json({ message: 'Could not create budget' })
  }
})

router.put('/budgets/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateBudgetInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const existing = await pool.query(
      `SELECT id FROM finance_budgets WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.auth.userId],
    )
    if (!existing.rowCount) return res.status(404).json({ message: 'Budget not found' })

    const budget = validation.value
    const category = await loadExpenseCategory(req.auth.userId, budget.categoryId)
    if (!category) return res.status(400).json({ message: 'Budgets can only use your expense categories.' })

    await pool.query(
      `UPDATE finance_budgets
       SET category_id = $1,
           budget_month = $2,
           currency = $3,
           amount = $4,
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6`,
      [budget.categoryId, budget.budgetMonth, budget.currency, budget.amount, req.params.id, req.auth.userId],
    )
    const overview = await getBudgetOverview(req.auth.userId, budget.budgetMonth, budget.currency)
    const updated = overview.budgets.find((row) => String(row.id) === String(req.params.id))
    return res.json({ budget: updated, summary: overview.summary })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'This category already has a budget for that month and currency.' })
    console.error('Budget update failed:', error)
    return res.status(500).json({ message: 'Could not update budget' })
  }
})

router.delete('/budgets/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await pool.query(
      `DELETE FROM finance_budgets
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.auth.userId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Budget not found' })
    return res.status(204).end()
  } catch (error) {
    console.error('Budget deletion failed:', error)
    return res.status(500).json({ message: 'Could not delete budget' })
  }
})


// Milestone 5: savings goals and financial targets.
// Goal allocations are tracking metadata. They never mutate account balances or cash-flow totals.
function validateGoalInput(body) {
  const name = cleanName(body.name)
  const goalType = cleanName(body.goalType)
  const currency = cleanCurrency(body.currency || 'GHS')
  const targetAmount = normalizeMoney(body.targetAmount, { allowNegative: false })
  const startingAmount = normalizeNonNegativeMoney(body.startingAmount ?? '0')
  const targetDate = normalizeDate(body.targetDate, { optional: true })
  const priority = cleanName(body.priority || 'Medium')
  const notes = cleanText(body.notes, 2000)

  if (!name || name.length > 120) return { error: 'Goal name must be between 1 and 120 characters.' }
  if (!GOAL_TYPES.has(goalType)) return { error: 'Choose a valid goal type.' }
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Currency must be a three-letter code such as GHS or USD.' }
  if (!targetAmount) return { error: 'Target amount must be greater than zero and have no more than two decimal places.' }
  if (startingAmount === null) return { error: 'Starting amount must be zero or a positive amount with no more than two decimal places.' }
  if (body.targetDate && !targetDate) return { error: 'Choose a valid target date.' }
  if (!GOAL_PRIORITIES.has(priority)) return { error: 'Choose Low, Medium or High priority.' }

  return { value: { name, goalType, currency, targetAmount, startingAmount, targetDate, priority, notes } }
}

function validateGoalEntryInput(body) {
  const entryType = cleanName(body.entryType || 'Contribution')
  const amount = normalizeMoney(body.amount, { allowNegative: false })
  const contributionDate = normalizeDate(body.contributionDate || todayIso())
  const notes = cleanText(body.notes, 300)

  if (!GOAL_ENTRY_TYPES.has(entryType)) return { error: 'Choose Contribution or Withdrawal.' }
  if (!amount) return { error: 'Amount must be greater than zero and have no more than two decimal places.' }
  if (!contributionDate) return { error: 'Choose a valid contribution date.' }
  return { value: { entryType, amount, contributionDate, notes } }
}

async function loadOwnedGoal(userId, goalId, database = pool, { forUpdate = false } = {}) {
  const result = await database.query(
    `SELECT id, user_id, name, goal_type, currency, target_amount, starting_amount,
            target_date, priority, notes, is_archived, created_at, updated_at
     FROM finance_savings_goals
     WHERE id = $1 AND user_id = $2
     LIMIT 1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [goalId, userId],
  )
  return result.rows[0] || null
}

async function goalCurrentSaved(userId, goalId, excludeEntryId = null, database = pool) {
  const params = [userId, goalId]
  let exclusion = ''
  if (excludeEntryId) {
    params.push(excludeEntryId)
    exclusion = `AND e.id <> $${params.length}`
  }
  const result = await database.query(
    `SELECT (
       g.starting_amount
       + COALESCE(SUM(CASE WHEN e.entry_type = 'Contribution' THEN e.amount ELSE -e.amount END), 0)
     )::numeric(18,2) AS current_saved
     FROM finance_savings_goals g
     LEFT JOIN finance_goal_contributions e
       ON e.goal_id = g.id AND e.user_id = g.user_id ${exclusion}
     WHERE g.user_id = $1 AND g.id = $2
     GROUP BY g.id`,
    params,
  )
  return Number(result.rows[0]?.current_saved || 0)
}

async function getGoalOverview(userId, includeArchived = true) {
  const result = await pool.query(
    `SELECT
       g.id,
       g.name,
       g.goal_type,
       g.currency,
       g.target_amount,
       g.starting_amount,
       g.target_date,
       g.priority,
       g.notes,
       g.is_archived,
       g.created_at,
       g.updated_at,
       COUNT(e.id)::int AS entry_count,
       COALESCE(SUM(CASE WHEN e.entry_type = 'Contribution' THEN e.amount ELSE 0 END), 0)::numeric(18,2) AS contributions,
       COALESCE(SUM(CASE WHEN e.entry_type = 'Withdrawal' THEN e.amount ELSE 0 END), 0)::numeric(18,2) AS withdrawals,
       (
         g.starting_amount
         + COALESCE(SUM(CASE WHEN e.entry_type = 'Contribution' THEN e.amount ELSE -e.amount END), 0)
       )::numeric(18,2) AS current_saved
     FROM finance_savings_goals g
     LEFT JOIN finance_goal_contributions e
       ON e.goal_id = g.id AND e.user_id = g.user_id
     WHERE g.user_id = $1
       AND ($2::boolean = TRUE OR g.is_archived = FALSE)
     GROUP BY g.id
     ORDER BY g.is_archived ASC,
              CASE g.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
              g.target_date NULLS LAST,
              LOWER(g.name) ASC`,
    [userId, includeArchived],
  )

  const entriesResult = await pool.query(
    `SELECT e.id, e.goal_id, e.entry_type, e.amount, e.contribution_date, e.notes, e.created_at, e.updated_at
     FROM finance_goal_contributions e
     JOIN finance_savings_goals g ON g.id = e.goal_id AND g.user_id = e.user_id
     WHERE e.user_id = $1
     ORDER BY e.contribution_date DESC, e.created_at DESC`,
    [userId],
  )

  const entriesByGoal = new Map()
  for (const entry of entriesResult.rows) {
    const key = String(entry.goal_id)
    if (!entriesByGoal.has(key)) entriesByGoal.set(key, [])
    entriesByGoal.get(key).push(entry)
  }

  const goals = result.rows.map((goal) => {
    const current = Number(goal.current_saved || 0)
    const target = Number(goal.target_amount || 0)
    const remaining = Math.max(target - current, 0)
    const percent = target > 0 ? (current / target) * 100 : 0
    return {
      ...goal,
      remaining: remaining.toFixed(2),
      percent_complete: Number(percent.toFixed(1)),
      status: current >= target ? 'Completed' : 'In Progress',
      entries: entriesByGoal.get(String(goal.id)) || [],
    }
  })

  const active = goals.filter((goal) => !goal.is_archived)
  const byCurrency = new Map()
  for (const goal of active) {
    if (!byCurrency.has(goal.currency)) {
      byCurrency.set(goal.currency, { currency: goal.currency, target: 0, saved: 0, remaining: 0, goals: 0, completed: 0 })
    }
    const row = byCurrency.get(goal.currency)
    row.target += Number(goal.target_amount || 0)
    row.saved += Number(goal.current_saved || 0)
    row.remaining += Number(goal.remaining || 0)
    row.goals += 1
    if (goal.status === 'Completed') row.completed += 1
  }

  const summary = Array.from(byCurrency.values()).map((row) => ({
    ...row,
    target: row.target.toFixed(2),
    saved: row.saved.toFixed(2),
    remaining: row.remaining.toFixed(2),
    percentComplete: row.target > 0 ? Number(((row.saved / row.target) * 100).toFixed(1)) : 0,
  }))

  return { goals, summary }
}

router.get('/goals', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const includeArchived = String(req.query.includeArchived || 'true').toLowerCase() !== 'false'
    const data = await getGoalOverview(req.auth.userId, includeArchived)
    return res.json(data)
  } catch (error) {
    console.error('Savings goals lookup failed:', error)
    return res.status(500).json({ message: 'Could not load savings goals' })
  }
})

router.post('/goals', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateGoalInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const goal = validation.value
    const result = await pool.query(
      `INSERT INTO finance_savings_goals
       (user_id, name, goal_type, currency, target_amount, starting_amount, target_date, priority, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [req.auth.userId, goal.name, goal.goalType, goal.currency, goal.targetAmount, goal.startingAmount, goal.targetDate, goal.priority, goal.notes],
    )
    const overview = await getGoalOverview(req.auth.userId, true)
    const created = overview.goals.find((item) => String(item.id) === String(result.rows[0].id))
    return res.status(201).json({ goal: created, summary: overview.summary })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'You already have a savings goal with this name.' })
    console.error('Savings goal creation failed:', error)
    return res.status(500).json({ message: 'Could not create savings goal' })
  }
})

router.put('/goals/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateGoalInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const existing = await loadOwnedGoal(req.auth.userId, req.params.id)
    if (!existing) return res.status(404).json({ message: 'Savings goal not found' })
    const count = await pool.query(
      `SELECT COUNT(*)::int AS count FROM finance_goal_contributions WHERE user_id = $1 AND goal_id = $2`,
      [req.auth.userId, req.params.id],
    )
    const goal = validation.value
    if (count.rows[0].count > 0) {
      if (goal.currency !== existing.currency) return res.status(409).json({ message: 'Currency cannot be changed after contribution history exists.' })
      if (Number(goal.startingAmount) !== Number(existing.starting_amount)) return res.status(409).json({ message: 'Starting amount cannot be changed after contribution history exists.' })
    }

    await pool.query(
      `UPDATE finance_savings_goals
       SET name=$1, goal_type=$2, currency=$3, target_amount=$4, starting_amount=$5,
           target_date=$6, priority=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 AND user_id=$10`,
      [goal.name, goal.goalType, goal.currency, goal.targetAmount, goal.startingAmount, goal.targetDate, goal.priority, goal.notes, req.params.id, req.auth.userId],
    )
    const overview = await getGoalOverview(req.auth.userId, true)
    const updated = overview.goals.find((item) => String(item.id) === String(req.params.id))
    return res.json({ goal: updated, summary: overview.summary })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'You already have a savings goal with this name.' })
    console.error('Savings goal update failed:', error)
    return res.status(500).json({ message: 'Could not update savings goal' })
  }
})

router.post('/goals/:id/archive', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await pool.query(
      `UPDATE finance_savings_goals SET is_archived=TRUE, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.auth.userId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Savings goal not found' })
    return res.json({ ok: true })
  } catch (error) {
    console.error('Savings goal archive failed:', error)
    return res.status(500).json({ message: 'Could not archive savings goal' })
  }
})

router.post('/goals/:id/restore', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await pool.query(
      `UPDATE finance_savings_goals SET is_archived=FALSE, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.auth.userId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Savings goal not found' })
    return res.json({ ok: true })
  } catch (error) {
    console.error('Savings goal restore failed:', error)
    return res.status(500).json({ message: 'Could not restore savings goal' })
  }
})

router.post('/goals/:id/entries', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateGoalEntryInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const entry = validation.value
    await withTransaction(async (client) => {
      const goal = await loadOwnedGoal(req.auth.userId, req.params.id, client, { forUpdate: true })
      if (!goal) throw new LedgerDataError('Savings goal not found.', 404, 'NOT_FOUND')
      if (goal.is_archived) throw new LedgerDataError('Restore this goal before changing its progress.', 409, 'GOAL_ARCHIVED')
      if (entry.entryType === 'Withdrawal') {
        const current = await goalCurrentSaved(req.auth.userId, req.params.id, null, client)
        if (Number(entry.amount) > current) {
          throw new LedgerDataError('Withdrawal cannot exceed the amount currently saved for this goal.', 409, 'INSUFFICIENT_GOAL_BALANCE')
        }
      }
      await client.query(
        `INSERT INTO finance_goal_contributions (user_id, goal_id, entry_type, amount, contribution_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.auth.userId, req.params.id, entry.entryType, entry.amount, entry.contributionDate, entry.notes],
      )
    })
    const overview = await getGoalOverview(req.auth.userId, true)
    const updated = overview.goals.find((item) => String(item.id) === String(req.params.id))
    return res.status(201).json({ goal: updated, summary: overview.summary })
  } catch (error) {
    if (error instanceof LedgerDataError) return res.status(error.status).json({ message: error.message, code: error.code })
    console.error('Goal contribution creation failed:', error)
    return res.status(500).json({ message: 'Could not record goal progress' })
  }
})

router.put('/goals/:goalId/entries/:entryId', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateGoalEntryInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const entry = validation.value
    await withTransaction(async (client) => {
      const goal = await loadOwnedGoal(req.auth.userId, req.params.goalId, client, { forUpdate: true })
      if (!goal) throw new LedgerDataError('Savings goal not found.', 404, 'NOT_FOUND')
      const owned = await client.query(
        `SELECT id FROM finance_goal_contributions
         WHERE id=$1 AND goal_id=$2 AND user_id=$3
         FOR UPDATE`,
        [req.params.entryId, req.params.goalId, req.auth.userId],
      )
      if (!owned.rowCount) throw new LedgerDataError('Goal progress entry not found.', 404, 'NOT_FOUND')
      const base = await goalCurrentSaved(req.auth.userId, req.params.goalId, req.params.entryId, client)
      const projected = entry.entryType === 'Contribution' ? base + Number(entry.amount) : base - Number(entry.amount)
      if (projected < 0) {
        throw new LedgerDataError('This change would make the goal allocation negative. Adjust later withdrawals first.', 409, 'NEGATIVE_GOAL_BALANCE')
      }
      await client.query(
        `UPDATE finance_goal_contributions
         SET entry_type=$1, amount=$2, contribution_date=$3, notes=$4, updated_at=NOW()
         WHERE id=$5 AND goal_id=$6 AND user_id=$7`,
        [entry.entryType, entry.amount, entry.contributionDate, entry.notes, req.params.entryId, req.params.goalId, req.auth.userId],
      )
    })
    const overview = await getGoalOverview(req.auth.userId, true)
    const updated = overview.goals.find((item) => String(item.id) === String(req.params.goalId))
    return res.json({ goal: updated, summary: overview.summary })
  } catch (error) {
    if (error instanceof LedgerDataError) return res.status(error.status).json({ message: error.message, code: error.code })
    console.error('Goal progress update failed:', error)
    return res.status(500).json({ message: 'Could not update goal progress' })
  }
})

router.delete('/goals/:goalId/entries/:entryId', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    await withTransaction(async (client) => {
      const goal = await loadOwnedGoal(req.auth.userId, req.params.goalId, client, { forUpdate: true })
      if (!goal) throw new LedgerDataError('Savings goal not found.', 404, 'NOT_FOUND')
      const existing = await client.query(
        `SELECT id FROM finance_goal_contributions
         WHERE id=$1 AND goal_id=$2 AND user_id=$3
         FOR UPDATE`,
        [req.params.entryId, req.params.goalId, req.auth.userId],
      )
      if (!existing.rowCount) throw new LedgerDataError('Goal progress entry not found.', 404, 'NOT_FOUND')
      const projected = await goalCurrentSaved(req.auth.userId, req.params.goalId, req.params.entryId, client)
      if (projected < 0) {
        throw new LedgerDataError('Deleting this contribution would make the goal allocation negative. Adjust later withdrawals first.', 409, 'NEGATIVE_GOAL_BALANCE')
      }
      await client.query(
        'DELETE FROM finance_goal_contributions WHERE id=$1 AND goal_id=$2 AND user_id=$3',
        [req.params.entryId, req.params.goalId, req.auth.userId],
      )
    })
    const overview = await getGoalOverview(req.auth.userId, true)
    const updated = overview.goals.find((item) => String(item.id) === String(req.params.goalId))
    return res.json({ goal: updated, summary: overview.summary })
  } catch (error) {
    if (error instanceof LedgerDataError) return res.status(error.status).json({ message: error.message, code: error.code })
    console.error('Goal progress deletion failed:', error)
    return res.status(500).json({ message: 'Could not delete goal progress entry' })
  }
})


// -----------------------------------------------------------------------------
// Milestone 6: recurring bills and recurring income
// -----------------------------------------------------------------------------

function validateRecurringInput(body) {
  const name = cleanName(body.name)
  const transactionType = cleanName(body.transactionType)
  const accountId = normalizeId(body.accountId)
  const categoryId = normalizeId(body.categoryId)
  const amount = normalizeMoney(body.amount, { allowNegative: false })
  const frequency = cleanName(body.frequency || 'Monthly')
  const nextDueDate = normalizeDate(body.nextDueDate || todayIso())
  const endDate = normalizeDate(body.endDate, { optional: true })
  const notes = cleanText(body.notes, 2000)

  if (!name || name.length > 120) return { error: 'Name is required and must be 120 characters or fewer.' }
  if (!['Income', 'Expense'].includes(transactionType)) return { error: 'Recurring type must be Income or Expense.' }
  if (!accountId) return { error: 'Choose an account.' }
  if (!categoryId) return { error: 'Choose a category.' }
  if (amount === null || Number(amount) <= 0) return { error: 'Amount must be greater than zero and use at most two decimal places.' }
  if (!RECURRING_FREQUENCIES.has(frequency)) return { error: 'Choose a valid recurrence frequency.' }
  if (!nextDueDate) return { error: 'Next due date is required.' }
  if (endDate && endDate < nextDueDate) return { error: 'End date cannot be earlier than the next due date.' }

  return { value: { name, transactionType, accountId, categoryId, amount, frequency, nextDueDate, endDate, notes } }
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

async function validateRecurringRelations(userId, recurring, { requireActive = true } = {}) {
  const account = await loadOwnedAccount(userId, recurring.accountId, { activeOnly: requireActive })
  if (!account) return { error: requireActive ? 'Choose an active account that belongs to you.' : 'Account not found.' }

  const categoryResult = await pool.query(
    `SELECT id, name, category_type FROM finance_categories
     WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [recurring.categoryId, userId],
  )
  const category = categoryResult.rows[0]
  if (!category) return { error: 'Category not found.' }
  if (category.category_type !== recurring.transactionType) {
    return { error: `${recurring.transactionType} schedules must use a ${recurring.transactionType.toLowerCase()} category.` }
  }

  return { value: { account, category, currency: account.currency } }
}

async function getRecurringOverview(userId, includeInactive = true) {
  const result = await pool.query(
    `SELECT
       r.id, r.name, r.transaction_type, r.account_id, r.category_id, r.amount,
       r.currency, r.frequency, r.next_due_date::text AS next_due_date, r.end_date::text AS end_date, r.anchor_day, r.notes, r.is_active,
       r.created_at, r.updated_at,
       a.name AS account_name, a.account_type, a.is_archived AS account_archived,
       c.name AS category_name,
       COUNT(o.id)::int AS occurrence_count,
       COUNT(o.id) FILTER (WHERE o.status = 'Posted')::int AS posted_count,
       COUNT(o.id) FILTER (WHERE o.status = 'Skipped')::int AS skipped_count,
       MAX(o.scheduled_date) AS last_processed_date,
       CASE
         WHEN r.is_active = FALSE THEN 'Paused'
         WHEN r.end_date IS NOT NULL AND r.next_due_date > r.end_date THEN 'Ended'
         WHEN r.next_due_date < CURRENT_DATE THEN 'Overdue'
         WHEN r.next_due_date = CURRENT_DATE THEN 'Due Today'
         ELSE 'Upcoming'
       END AS due_status
     FROM finance_recurring_items r
     JOIN finance_accounts a ON a.id = r.account_id AND a.user_id = r.user_id
     JOIN finance_categories c ON c.id = r.category_id AND c.user_id = r.user_id
     LEFT JOIN finance_recurring_occurrences o ON o.recurring_item_id = r.id AND o.user_id = r.user_id
     WHERE r.user_id = $1
       AND ($2::boolean = TRUE OR r.is_active = TRUE)
     GROUP BY r.id, a.id, c.id
     ORDER BY r.is_active DESC,
              CASE WHEN r.next_due_date < CURRENT_DATE THEN 0 WHEN r.next_due_date = CURRENT_DATE THEN 1 ELSE 2 END,
              r.next_due_date ASC,
              LOWER(r.name) ASC`,
    [userId, includeInactive],
  )

  const upcoming = result.rows.filter((item) => item.is_active && (!item.end_date || item.next_due_date <= item.end_date))
  const byCurrency = new Map()
  const today = new Date(`${todayIso()}T00:00:00Z`)
  const horizon = new Date(today)
  horizon.setUTCDate(horizon.getUTCDate() + 30)
  const horizonIso = toIsoDate(horizon)
  let dueNext30Days = 0

  for (const item of upcoming) {
    if (!byCurrency.has(item.currency)) {
      byCurrency.set(item.currency, { currency: item.currency, income30: 0, expenses30: 0, dueItems30: 0 })
    }
    const occurrences = recurringOccurrencesInRange({
      nextDueDate: item.next_due_date,
      frequency: item.frequency,
      endDate: item.end_date,
      from: todayIso(),
      to: horizonIso,
      anchorDay: item.anchor_day,
    })
    dueNext30Days += occurrences.length
    if (occurrences.length) {
      const row = byCurrency.get(item.currency)
      row.dueItems30 += occurrences.length
      if (item.transaction_type === 'Income') row.income30 += Number(item.amount || 0) * occurrences.length
      else row.expenses30 += Number(item.amount || 0) * occurrences.length
    }
  }

  const summary = {
    active: upcoming.length,
    paused: result.rows.filter((item) => !item.is_active).length,
    overdue: upcoming.filter((item) => item.next_due_date < todayIso()).length,
    dueToday: upcoming.filter((item) => item.next_due_date === todayIso()).length,
    dueNext30Days,
    byCurrency: Array.from(byCurrency.values()).map((row) => ({
      ...row,
      income30: row.income30.toFixed(2),
      expenses30: row.expenses30.toFixed(2),
      net30: (row.income30 - row.expenses30).toFixed(2),
    })),
  }

  return { items: result.rows, summary }
}

router.get('/recurring', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const includeInactive = String(req.query.includeInactive || 'true').toLowerCase() !== 'false'
    const [recurring, accounts, categories] = await Promise.all([
      getRecurringOverview(req.auth.userId, includeInactive),
      getAccountRows(req.auth.userId, true),
      getCategories(req.auth.userId),
    ])
    return res.json({ ...recurring, accounts, categories })
  } catch (error) {
    console.error('Recurring cash flow lookup failed:', error)
    return res.status(500).json({ message: 'Could not load recurring cash flow' })
  }
})

router.post('/recurring', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateRecurringInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const relations = await validateRecurringRelations(req.auth.userId, validation.value, { requireActive: true })
    if (relations.error) return res.status(400).json({ message: relations.error })
    const item = validation.value
    const result = await pool.query(
      `INSERT INTO finance_recurring_items
       (user_id, name, transaction_type, account_id, category_id, amount, currency, frequency, next_due_date, end_date, notes, anchor_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [req.auth.userId, item.name, item.transactionType, item.accountId, item.categoryId, item.amount, relations.value.currency, item.frequency, item.nextDueDate, item.endDate, item.notes, Number(item.nextDueDate.slice(8, 10))],
    )
    const data = await getRecurringOverview(req.auth.userId, true)
    const created = data.items.find((row) => String(row.id) === String(result.rows[0].id))
    return res.status(201).json({ item: created, summary: data.summary })
  } catch (error) {
    console.error('Recurring item creation failed:', error)
    return res.status(500).json({ message: 'Could not create recurring item' })
  }
})

router.put('/recurring/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  const validation = validateRecurringInput(req.body || {})
  if (validation.error) return res.status(400).json({ message: validation.error })

  try {
    const existing = await pool.query(`SELECT id FROM finance_recurring_items WHERE id=$1 AND user_id=$2 LIMIT 1`, [req.params.id, req.auth.userId])
    if (!existing.rowCount) return res.status(404).json({ message: 'Recurring item not found' })
    const relations = await validateRecurringRelations(req.auth.userId, validation.value, { requireActive: false })
    if (relations.error) return res.status(400).json({ message: relations.error })
    const item = validation.value
    await pool.query(
      `UPDATE finance_recurring_items
       SET name=$1, transaction_type=$2, account_id=$3, category_id=$4, amount=$5,
           currency=$6, frequency=$7, next_due_date=$8, end_date=$9, notes=$10, anchor_day=$11, updated_at=NOW()
       WHERE id=$12 AND user_id=$13`,
      [item.name, item.transactionType, item.accountId, item.categoryId, item.amount, relations.value.currency, item.frequency, item.nextDueDate, item.endDate, item.notes, Number(item.nextDueDate.slice(8, 10)), req.params.id, req.auth.userId],
    )
    const data = await getRecurringOverview(req.auth.userId, true)
    const updated = data.items.find((row) => String(row.id) === String(req.params.id))
    return res.json({ item: updated, summary: data.summary })
  } catch (error) {
    console.error('Recurring item update failed:', error)
    return res.status(500).json({ message: 'Could not update recurring item' })
  }
})

router.post('/recurring/:id/pause', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await pool.query(
      `UPDATE finance_recurring_items SET is_active=FALSE, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.auth.userId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Recurring item not found' })
    return res.json({ ok: true })
  } catch (error) {
    console.error('Recurring pause failed:', error)
    return res.status(500).json({ message: 'Could not pause recurring item' })
  }
})

router.post('/recurring/:id/resume', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await pool.query(
      `UPDATE finance_recurring_items SET is_active=TRUE, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND (end_date IS NULL OR next_due_date <= end_date) RETURNING id`,
      [req.params.id, req.auth.userId],
    )
    if (!result.rowCount) return res.status(409).json({ message: 'This schedule has ended or could not be found. Edit its dates before resuming.' })
    return res.json({ ok: true })
  } catch (error) {
    console.error('Recurring resume failed:', error)
    return res.status(500).json({ message: 'Could not resume recurring item' })
  }
})

router.delete('/recurring/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const history = await pool.query(`SELECT COUNT(*)::int AS count FROM finance_recurring_occurrences WHERE recurring_item_id=$1 AND user_id=$2`, [req.params.id, req.auth.userId])
    if (Number(history.rows[0]?.count || 0) > 0) {
      return res.status(409).json({ message: 'This schedule has history. Pause it instead of deleting it.' })
    }
    const result = await pool.query(`DELETE FROM finance_recurring_items WHERE id=$1 AND user_id=$2 RETURNING id`, [req.params.id, req.auth.userId])
    if (!result.rowCount) return res.status(404).json({ message: 'Recurring item not found' })
    return res.status(204).end()
  } catch (error) {
    console.error('Recurring item deletion failed:', error)
    return res.status(500).json({ message: 'Could not delete recurring item' })
  }
})

async function processRecurringOccurrence(userId, itemId, action, body = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const itemResult = await client.query(
      `SELECT r.*, r.next_due_date::text AS next_due_date, r.end_date::text AS end_date, a.name AS account_name, a.is_archived AS account_archived, c.name AS category_name, c.category_type
       FROM finance_recurring_items r
       JOIN finance_accounts a ON a.id=r.account_id AND a.user_id=r.user_id
       JOIN finance_categories c ON c.id=r.category_id AND c.user_id=r.user_id
       WHERE r.id=$1 AND r.user_id=$2
       FOR UPDATE`,
      [itemId, userId],
    )
    if (!itemResult.rowCount) {
      await client.query('ROLLBACK')
      return { status: 404, error: 'Recurring item not found' }
    }
    const item = itemResult.rows[0]
    if (!item.is_active) {
      await client.query('ROLLBACK')
      return { status: 409, error: 'Resume this recurring item before processing it.' }
    }
    if (item.end_date && String(item.next_due_date).slice(0, 10) > String(item.end_date).slice(0, 10)) {
      await client.query(`UPDATE finance_recurring_items SET is_active=FALSE, updated_at=NOW() WHERE id=$1 AND user_id=$2`, [itemId, userId])
      await client.query('COMMIT')
      return { status: 409, error: 'This recurring schedule has already ended.' }
    }
    const scheduledDate = String(item.next_due_date).slice(0, 10)
    const duplicate = await client.query(
      `SELECT id FROM finance_recurring_occurrences WHERE recurring_item_id=$1 AND scheduled_date=$2 LIMIT 1`,
      [itemId, scheduledDate],
    )
    if (duplicate.rowCount) {
      await client.query('ROLLBACK')
      return { status: 409, error: 'This scheduled occurrence has already been processed.' }
    }

    let transactionId = null
    let actualAmount = null
    if (action === 'Posted') {
      if (item.account_archived) {
        await client.query('ROLLBACK')
        return { status: 409, error: 'The linked account is archived. Restore it or edit the recurring item first.' }
      }
      const amount = body.amount === undefined || body.amount === ''
        ? String(item.amount)
        : normalizeMoney(body.amount, { allowNegative: false })
      const transactionDate = normalizeDate(body.transactionDate || todayIso())
      if (amount === null || Number(amount) <= 0) {
        await client.query('ROLLBACK')
        return { status: 400, error: 'Actual amount must be greater than zero.' }
      }
      if (!transactionDate) {
        await client.query('ROLLBACK')
        return { status: 400, error: 'Transaction date is invalid.' }
      }
      const tx = await createLedgerTransaction(client, {
        userId,
        transaction: {
          accountId: item.account_id,
          transactionType: item.transaction_type,
          categoryId: item.category_id,
          transferAccountId: null,
          amount,
          description: item.name,
          notes: item.notes ? `Recurring schedule: ${item.notes}` : 'Recurring schedule',
          transactionDate,
        },
        idempotencyKey: `recurring:${itemId}:${scheduledDate}`,
      })
      transactionId = tx.id
      actualAmount = amount
    }

    await client.query(
      `INSERT INTO finance_recurring_occurrences
       (user_id, recurring_item_id, scheduled_date, status, transaction_id, actual_amount)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, itemId, scheduledDate, action, transactionId, actualAmount],
    )

    const nextDueDate = advanceRecurringDate(scheduledDate, item.frequency, item.anchor_day)
    const stillActive = !item.end_date || nextDueDate <= String(item.end_date).slice(0, 10)
    await client.query(
      `UPDATE finance_recurring_items
       SET next_due_date=$1, is_active=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4`,
      [nextDueDate, stillActive, itemId, userId],
    )
    await client.query('COMMIT')
    return { status: 200, transactionId, nextDueDate, isActive: stillActive }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

router.post('/recurring/:id/post', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await processRecurringOccurrence(req.auth.userId, req.params.id, 'Posted', req.body || {})
    if (result.error) return res.status(result.status).json({ message: result.error })
    const data = await getRecurringOverview(req.auth.userId, true)
    return res.json({ ok: true, ...result, recurring: data })
  } catch (error) {
    console.error('Recurring posting failed:', error)
    return res.status(500).json({ message: 'Could not post recurring transaction' })
  }
})

router.post('/recurring/:id/skip', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const result = await processRecurringOccurrence(req.auth.userId, req.params.id, 'Skipped', {})
    if (result.error) return res.status(result.status).json({ message: result.error })
    const data = await getRecurringOverview(req.auth.userId, true)
    return res.json({ ok: true, ...result, recurring: data })
  } catch (error) {
    console.error('Recurring skip failed:', error)
    return res.status(500).json({ message: 'Could not skip recurring occurrence' })
  }
})


// Milestone 7: financial analytics. All metrics are derived from the existing ledger;
// no parallel "analytics balances" are stored.
function normalizeAnalyticsMonths(value) {
  const parsed = Number.parseInt(String(value ?? '6'), 10)
  if (![3, 6, 12].includes(parsed)) return 6
  return parsed
}

function percentChange(current, previous) {
  const currentValue = Number(current || 0)
  const previousValue = Number(previous || 0)
  if (previousValue === 0) return currentValue === 0 ? 0 : null
  return Number((((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1))
}

async function getAnalyticsOverview(userId, currencyInput = 'GHS', monthsInput = 6) {
  const currency = cleanCurrency(currencyInput || 'GHS')
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_CURRENCY')
  const months = normalizeAnalyticsMonths(monthsInput)

  const [trendResult, categoryResult, accountTypeResult, currencyResult] = await Promise.all([
    pool.query(
      `WITH month_series AS (
         SELECT generate_series(
           (DATE_TRUNC('month', CURRENT_DATE) - (($3::int - 1) * INTERVAL '1 month'))::date,
           DATE_TRUNC('month', CURRENT_DATE)::date,
           INTERVAL '1 month'
         )::date AS month_start
       ),
       flow AS (
         SELECT
           DATE_TRUNC('month', transaction_date)::date AS month_start,
           COALESCE(SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END), 0)::numeric(18,2) AS income,
           COALESCE(SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END), 0)::numeric(18,2) AS expenses,
           COUNT(*) FILTER (WHERE transaction_type IN ('Income','Expense'))::int AS transaction_count
         FROM finance_transactions
         WHERE user_id = $1
           AND currency = $2
           AND transaction_date >= (DATE_TRUNC('month', CURRENT_DATE) - (($3::int - 1) * INTERVAL '1 month'))::date
           AND transaction_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
         GROUP BY DATE_TRUNC('month', transaction_date)::date
       )
       SELECT
         TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
         COALESCE(f.income, 0)::numeric(18,2) AS income,
         COALESCE(f.expenses, 0)::numeric(18,2) AS expenses,
         (COALESCE(f.income, 0) - COALESCE(f.expenses, 0))::numeric(18,2) AS net_cash_flow,
         COALESCE(f.transaction_count, 0)::int AS transaction_count
       FROM month_series ms
       LEFT JOIN flow f ON f.month_start = ms.month_start
       ORDER BY ms.month_start`,
      [userId, currency, months],
    ),
    pool.query(
      `SELECT
         c.id AS category_id,
         c.name AS category_name,
         COALESCE(SUM(t.amount), 0)::numeric(18,2) AS spent,
         COUNT(t.id)::int AS transaction_count
       FROM finance_transactions t
       JOIN finance_categories c ON c.id = t.category_id AND c.user_id = t.user_id
       WHERE t.user_id = $1
         AND t.currency = $2
         AND t.transaction_type = 'Expense'
         AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)::date
         AND t.transaction_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
       GROUP BY c.id, c.name
       HAVING SUM(t.amount) > 0
       ORDER BY SUM(t.amount) DESC, LOWER(c.name) ASC`,
      [userId, currency],
    ),
    pool.query(
      `WITH movements AS (
         SELECT account_id,
                CASE
                  WHEN transaction_type = 'Income' THEN amount
                  WHEN transaction_type = 'Expense' THEN -amount
                  WHEN transaction_type = 'Transfer' THEN -amount
                  ELSE 0
                END AS delta
         FROM finance_transactions
         WHERE user_id = $1

         UNION ALL

         SELECT transfer_account_id AS account_id, amount AS delta
         FROM finance_transactions
         WHERE user_id = $1
           AND transaction_type = 'Transfer'
           AND transfer_account_id IS NOT NULL
       ),
       account_balances AS (
         SELECT
           a.id,
           a.account_type,
           (a.opening_balance + COALESCE(SUM(m.delta), 0))::numeric(18,2) AS current_balance
         FROM finance_accounts a
         LEFT JOIN movements m ON m.account_id = a.id
         WHERE a.user_id = $1
           AND a.currency = $2
         GROUP BY a.id
       )
       SELECT account_type,
              COALESCE(SUM(current_balance), 0)::numeric(18,2) AS balance,
              COUNT(*)::int AS accounts
       FROM account_balances
       GROUP BY account_type
       ORDER BY ABS(SUM(current_balance)) DESC, account_type`,
      [userId, currency],
    ),
    pool.query(
      `SELECT currency FROM finance_accounts WHERE user_id = $1
       UNION
       SELECT currency FROM finance_transactions WHERE user_id = $1
       UNION
       SELECT currency FROM finance_budgets WHERE user_id = $1
       UNION
       SELECT currency FROM finance_savings_goals WHERE user_id = $1
       ORDER BY currency`,
      [userId],
    ),
  ])

  const trend = trendResult.rows.map((row) => ({
    ...row,
    income: Number(row.income || 0),
    expenses: Number(row.expenses || 0),
    netCashFlow: Number(row.net_cash_flow || 0),
    transactionCount: Number(row.transaction_count || 0),
  }))

  const current = trend.at(-1) || { month: currentBudgetMonth(), income: 0, expenses: 0, netCashFlow: 0, transactionCount: 0 }
  const previous = trend.at(-2) || { month: '', income: 0, expenses: 0, netCashFlow: 0, transactionCount: 0 }
  const savingsRate = current.income > 0 ? Number(((current.netCashFlow / current.income) * 100).toFixed(1)) : 0
  const averageIncome = trend.length ? trend.reduce((sum, row) => sum + row.income, 0) / trend.length : 0
  const averageExpenses = trend.length ? trend.reduce((sum, row) => sum + row.expenses, 0) / trend.length : 0
  const averageNet = trend.length ? trend.reduce((sum, row) => sum + row.netCashFlow, 0) / trend.length : 0

  const budgetData = await getBudgetOverview(userId, currentBudgetMonth(), currency)
  const goalData = await getGoalOverview(userId, false)
  const recurringData = await getRecurringOverview(userId, false)

  const selectedGoals = goalData.goals.filter((goal) => goal.currency === currency)
  const goalTarget = selectedGoals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0)
  const goalSaved = selectedGoals.reduce((sum, goal) => sum + Number(goal.current_saved || 0), 0)
  const recurringCurrency = recurringData.summary.byCurrency.find((row) => row.currency === currency)

  const totalCategorySpend = categoryResult.rows.reduce((sum, row) => sum + Number(row.spent || 0), 0)
  const categories = categoryResult.rows.map((row) => ({
    ...row,
    spent: Number(row.spent || 0),
    transactionCount: Number(row.transaction_count || 0),
    share: totalCategorySpend > 0 ? Number(((Number(row.spent || 0) / totalCategorySpend) * 100).toFixed(1)) : 0,
  }))

  const accountsByType = accountTypeResult.rows.map((row) => ({
    accountType: row.account_type,
    balance: Number(row.balance || 0),
    accounts: Number(row.accounts || 0),
  }))

  const overBudgetCount = budgetData.budgets.filter((row) => Number(row.percent_used || 0) > 100).length
  const watchBudgetCount = budgetData.budgets.filter((row) => Number(row.percent_used || 0) >= 80 && Number(row.percent_used || 0) <= 100).length

  return {
    currency,
    months,
    availableCurrencies: currencyResult.rows.map((row) => row.currency),
    current: {
      ...current,
      savingsRate,
    },
    previous,
    comparison: {
      incomeChange: percentChange(current.income, previous.income),
      expenseChange: percentChange(current.expenses, previous.expenses),
      netChange: percentChange(current.netCashFlow, previous.netCashFlow),
    },
    averages: {
      income: Number(averageIncome.toFixed(2)),
      expenses: Number(averageExpenses.toFixed(2)),
      netCashFlow: Number(averageNet.toFixed(2)),
    },
    trend,
    categories,
    accountsByType,
    budget: {
      summary: budgetData.summary,
      rows: budgetData.budgets,
      unbudgeted: budgetData.unbudgeted,
      overBudgetCount,
      watchBudgetCount,
    },
    goals: {
      activeCount: selectedGoals.length,
      completedCount: selectedGoals.filter((goal) => goal.status === 'Completed').length,
      target: Number(goalTarget.toFixed(2)),
      saved: Number(goalSaved.toFixed(2)),
      remaining: Number(Math.max(goalTarget - goalSaved, 0).toFixed(2)),
      percentComplete: goalTarget > 0 ? Number(((goalSaved / goalTarget) * 100).toFixed(1)) : 0,
    },
    recurring30: {
      dueItems: Number(recurringCurrency?.dueItems30 || 0),
      income: Number(recurringCurrency?.income30 || 0),
      expenses: Number(recurringCurrency?.expenses30 || 0),
      net: Number(recurringCurrency?.net30 || 0),
    },
  }
}

router.get('/analytics', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const data = await getAnalyticsOverview(req.auth.userId, req.query.currency || 'GHS', req.query.months || '6')
    return res.json(data)
  } catch (error) {
    if (error.message === 'INVALID_CURRENCY') return res.status(400).json({ message: 'Use a valid three-letter currency code.' })
    console.error('Financial analytics lookup failed:', error)
    return res.status(500).json({ message: 'Could not load financial analytics' })
  }
})


// Milestone 8: date-range reports and export-ready statement data.
// Reports are derived from the existing ledger and never store duplicate totals.
function defaultReportRange() {
  return {
    from: `${currentBudgetMonth()}-01`,
    to: todayIso(),
  }
}

function normalizeReportRange(query = {}) {
  const defaults = defaultReportRange()
  const from = normalizeDate(query.from, { optional: true }) || defaults.from
  const to = normalizeDate(query.to, { optional: true }) || defaults.to
  const currency = cleanCurrency(query.currency || 'GHS')

  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_CURRENCY')
  if (!from || !to) throw new Error('INVALID_REPORT_DATE')
  if (from > to) throw new Error('INVALID_REPORT_RANGE')

  const fromTime = new Date(`${from}T00:00:00Z`).getTime()
  const toTime = new Date(`${to}T00:00:00Z`).getTime()
  const days = Math.round((toTime - fromTime) / 86400000)
  if (days > 3660) throw new Error('REPORT_RANGE_TOO_LARGE')

  return { from, to, currency }
}

async function getReportOverview(userId, query = {}) {
  const { from, to, currency } = normalizeReportRange(query)

  const [summaryResult, categoryResult, accountResult, monthlyResult, transactionResult, currencyResult] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END), 0)::numeric(18,2) AS income,
         COALESCE(SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END), 0)::numeric(18,2) AS expenses,
         COALESCE(SUM(CASE WHEN transaction_type = 'Transfer' THEN amount ELSE 0 END), 0)::numeric(18,2) AS transfer_volume,
         COUNT(*) FILTER (WHERE transaction_type = 'Income')::int AS income_count,
         COUNT(*) FILTER (WHERE transaction_type = 'Expense')::int AS expense_count,
         COUNT(*) FILTER (WHERE transaction_type = 'Transfer')::int AS transfer_count,
         COUNT(*)::int AS total_entries
       FROM finance_transactions
       WHERE user_id = $1
         AND currency = $2
         AND transaction_date >= $3::date
         AND transaction_date <= $4::date`,
      [userId, currency, from, to],
    ),
    pool.query(
      `SELECT
         t.transaction_type,
         c.id AS category_id,
         c.name AS category_name,
         COALESCE(SUM(t.amount), 0)::numeric(18,2) AS amount,
         COUNT(t.id)::int AS transaction_count
       FROM finance_transactions t
       JOIN finance_categories c ON c.id = t.category_id AND c.user_id = t.user_id
       WHERE t.user_id = $1
         AND t.currency = $2
         AND t.transaction_type IN ('Income', 'Expense')
         AND t.transaction_date >= $3::date
         AND t.transaction_date <= $4::date
       GROUP BY t.transaction_type, c.id, c.name
       ORDER BY t.transaction_type, SUM(t.amount) DESC, LOWER(c.name) ASC`,
      [userId, currency, from, to],
    ),
    pool.query(
      `WITH activity AS (
         SELECT account_id,
                CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END AS inflow,
                CASE WHEN transaction_type IN ('Expense', 'Transfer') THEN amount ELSE 0 END AS outflow
         FROM finance_transactions
         WHERE user_id = $1
           AND currency = $2
           AND transaction_date >= $3::date
           AND transaction_date <= $4::date

         UNION ALL

         SELECT transfer_account_id AS account_id,
                amount AS inflow,
                0::numeric AS outflow
         FROM finance_transactions
         WHERE user_id = $1
           AND currency = $2
           AND transaction_type = 'Transfer'
           AND transfer_account_id IS NOT NULL
           AND transaction_date >= $3::date
           AND transaction_date <= $4::date
       )
       SELECT
         a.id AS account_id,
         a.name AS account_name,
         a.account_type,
         a.is_archived,
         COALESCE(SUM(activity.inflow), 0)::numeric(18,2) AS inflow,
         COALESCE(SUM(activity.outflow), 0)::numeric(18,2) AS outflow,
         (COALESCE(SUM(activity.inflow), 0) - COALESCE(SUM(activity.outflow), 0))::numeric(18,2) AS net_movement
       FROM finance_accounts a
       LEFT JOIN activity ON activity.account_id = a.id
       WHERE a.user_id = $1
         AND a.currency = $2
       GROUP BY a.id
       HAVING COALESCE(SUM(activity.inflow), 0) <> 0 OR COALESCE(SUM(activity.outflow), 0) <> 0
       ORDER BY ABS(COALESCE(SUM(activity.inflow), 0) - COALESCE(SUM(activity.outflow), 0)) DESC, LOWER(a.name) ASC`,
      [userId, currency, from, to],
    ),
    pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM') AS month,
         COALESCE(SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END), 0)::numeric(18,2) AS income,
         COALESCE(SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END), 0)::numeric(18,2) AS expenses,
         (COALESCE(SUM(CASE WHEN transaction_type = 'Income' THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END), 0))::numeric(18,2) AS net_cash_flow,
         COUNT(*)::int AS total_entries
       FROM finance_transactions
       WHERE user_id = $1
         AND currency = $2
         AND transaction_date >= $3::date
         AND transaction_date <= $4::date
       GROUP BY DATE_TRUNC('month', transaction_date)
       ORDER BY DATE_TRUNC('month', transaction_date)`,
      [userId, currency, from, to],
    ),
    pool.query(
      `SELECT
         t.id,
         t.transaction_type,
         t.amount,
         t.currency,
         t.description,
         t.notes,
         t.transaction_date,
         a.name AS account_name,
         c.name AS category_name,
         ta.name AS transfer_account_name
       FROM finance_transactions t
       JOIN finance_accounts a ON a.id = t.account_id AND a.user_id = t.user_id
       LEFT JOIN finance_categories c ON c.id = t.category_id AND c.user_id = t.user_id
       LEFT JOIN finance_accounts ta ON ta.id = t.transfer_account_id AND ta.user_id = t.user_id
       WHERE t.user_id = $1
         AND t.currency = $2
         AND t.transaction_date >= $3::date
         AND t.transaction_date <= $4::date
       ORDER BY t.transaction_date ASC, t.created_at ASC
       LIMIT 10000`,
      [userId, currency, from, to],
    ),
    pool.query(
      `SELECT currency FROM finance_accounts WHERE user_id = $1
       UNION
       SELECT currency FROM finance_transactions WHERE user_id = $1
       UNION
       SELECT currency FROM finance_budgets WHERE user_id = $1
       UNION
       SELECT currency FROM finance_savings_goals WHERE user_id = $1
       ORDER BY currency`,
      [userId],
    ),
  ])

  const rawSummary = summaryResult.rows[0] || {}
  const income = Number(rawSummary.income || 0)
  const expenses = Number(rawSummary.expenses || 0)
  const transferVolume = Number(rawSummary.transfer_volume || 0)
  const netCashFlow = income - expenses
  const savingsRate = income > 0 ? Number(((netCashFlow / income) * 100).toFixed(1)) : 0

  const categories = categoryResult.rows.map((row) => ({
    transactionType: row.transaction_type,
    categoryId: row.category_id,
    categoryName: row.category_name,
    amount: Number(row.amount || 0),
    transactionCount: Number(row.transaction_count || 0),
  }))
  const incomeCategories = categories.filter((row) => row.transactionType === 'Income')
  const expenseCategories = categories.filter((row) => row.transactionType === 'Expense')
  const expenseTotal = expenseCategories.reduce((sum, row) => sum + row.amount, 0)
  const incomeTotal = incomeCategories.reduce((sum, row) => sum + row.amount, 0)

  return {
    filters: { from, to, currency },
    availableCurrencies: currencyResult.rows.map((row) => row.currency),
    summary: {
      income,
      expenses,
      netCashFlow: Number(netCashFlow.toFixed(2)),
      transferVolume,
      savingsRate,
      incomeCount: Number(rawSummary.income_count || 0),
      expenseCount: Number(rawSummary.expense_count || 0),
      transferCount: Number(rawSummary.transfer_count || 0),
      totalEntries: Number(rawSummary.total_entries || 0),
    },
    incomeCategories: incomeCategories.map((row) => ({
      ...row,
      share: incomeTotal > 0 ? Number(((row.amount / incomeTotal) * 100).toFixed(1)) : 0,
    })),
    expenseCategories: expenseCategories.map((row) => ({
      ...row,
      share: expenseTotal > 0 ? Number(((row.amount / expenseTotal) * 100).toFixed(1)) : 0,
    })),
    accountActivity: accountResult.rows.map((row) => ({
      accountId: row.account_id,
      accountName: row.account_name,
      accountType: row.account_type,
      isArchived: row.is_archived,
      inflow: Number(row.inflow || 0),
      outflow: Number(row.outflow || 0),
      netMovement: Number(row.net_movement || 0),
    })),
    monthly: monthlyResult.rows.map((row) => ({
      month: row.month,
      income: Number(row.income || 0),
      expenses: Number(row.expenses || 0),
      netCashFlow: Number(row.net_cash_flow || 0),
      totalEntries: Number(row.total_entries || 0),
    })),
    transactions: transactionResult.rows,
    generatedAt: new Date().toISOString(),
    transactionLimit: 10000,
    truncated: Number(rawSummary.total_entries || 0) > 10000,
  }
}

router.get('/reports', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    const report = await getReportOverview(req.auth.userId, req.query)
    return res.json(report)
  } catch (error) {
    if (error.message === 'INVALID_CURRENCY') return res.status(400).json({ message: 'Use a valid three-letter currency code.' })
    if (error.message === 'INVALID_REPORT_DATE') return res.status(400).json({ message: 'Use valid report dates in YYYY-MM-DD format.' })
    if (error.message === 'INVALID_REPORT_RANGE') return res.status(400).json({ message: 'Report start date must be on or before the end date.' })
    if (error.message === 'REPORT_RANGE_TOO_LARGE') return res.status(400).json({ message: 'Choose a report range of 10 years or less.' })
    console.error('Financial report lookup failed:', error)
    return res.status(500).json({ message: 'Could not generate financial report' })
  }
})


async function getAlertsOverview(userId) {
  const alerts = []
  const today = todayIso()
  const month = currentBudgetMonth()
  const accounts = await getAccountRows(userId, false)
  const accountMap = new Map(accounts.map((account) => [String(account.id), account]))

  for (const account of accounts) {
    const balance = Number(account.current_balance || 0)
    if (balance < 0) {
      alerts.push({
        id: `negative-account-${account.id}`,
        severity: 'critical',
        kind: 'account',
        title: `${account.name} has a negative balance`,
        message: `${account.currency} ${Math.abs(balance).toFixed(2)} is below zero. Review recent transactions or fund this account.`,
        currency: account.currency,
        amount: balance,
        action: 'accounts',
      })
    }
  }

  const budgetResult = await pool.query(
    `SELECT b.id, b.category_id, c.name AS category_name, b.currency, b.amount,
            COALESCE(SUM(t.amount), 0)::numeric(18,2) AS spent,
            CASE WHEN b.amount > 0 THEN ROUND((COALESCE(SUM(t.amount), 0) / b.amount) * 100, 1) ELSE 0 END AS percent_used
     FROM finance_budgets b
     JOIN finance_categories c ON c.id = b.category_id AND c.user_id = b.user_id
     LEFT JOIN finance_transactions t
       ON t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.transaction_type = 'Expense'
      AND t.currency = b.currency
      AND t.transaction_date >= b.budget_month
      AND t.transaction_date < (b.budget_month + INTERVAL '1 month')::date
     WHERE b.user_id = $1 AND b.budget_month = $2::date
     GROUP BY b.id, c.name`,
    [userId, month],
  )

  for (const budget of budgetResult.rows) {
    const percent = Number(budget.percent_used || 0)
    const spent = Number(budget.spent || 0)
    const amount = Number(budget.amount || 0)
    if (percent > 100) {
      alerts.push({
        id: `budget-over-${budget.id}`,
        severity: 'critical',
        kind: 'budget',
        title: `${budget.category_name} is over budget`,
        message: `Spent ${budget.currency} ${spent.toFixed(2)} against ${budget.currency} ${amount.toFixed(2)} (${percent.toFixed(1)}%).`,
        currency: budget.currency,
        amount: spent - amount,
        action: 'budgets',
      })
    } else if (percent >= 80) {
      alerts.push({
        id: `budget-watch-${budget.id}`,
        severity: 'warning',
        kind: 'budget',
        title: `${budget.category_name} is nearing its limit`,
        message: `${percent.toFixed(1)}% of this month's ${budget.currency} budget has been used.`,
        currency: budget.currency,
        amount: amount - spent,
        action: 'budgets',
      })
    }
  }

  const recurring = await getRecurringOverview(userId, false)
  const sevenDays = new Date(`${today}T00:00:00Z`)
  sevenDays.setUTCDate(sevenDays.getUTCDate() + 7)
  const sevenIso = toIsoDate(sevenDays)

  for (const item of recurring.items.filter((row) => row.is_active)) {
    if (item.next_due_date < today) {
      alerts.push({
        id: `recurring-overdue-${item.id}`,
        severity: item.transaction_type === 'Expense' ? 'critical' : 'warning',
        kind: 'recurring',
        title: `${item.name} is overdue`,
        message: `${item.transaction_type} of ${item.currency} ${Number(item.amount).toFixed(2)} was due ${item.next_due_date}. Post or skip the occurrence.`,
        currency: item.currency,
        amount: Number(item.amount),
        action: 'recurring',
      })
    } else if (item.next_due_date === today) {
      alerts.push({
        id: `recurring-today-${item.id}`,
        severity: 'warning',
        kind: 'recurring',
        title: `${item.name} is due today`,
        message: `${item.transaction_type} of ${item.currency} ${Number(item.amount).toFixed(2)} is scheduled today.`,
        currency: item.currency,
        amount: Number(item.amount),
        action: 'recurring',
      })
    }

    if (item.transaction_type === 'Expense' && item.next_due_date >= today && item.next_due_date <= sevenIso) {
      const account = accountMap.get(String(item.account_id))
      const balance = Number(account?.current_balance || 0)
      const amount = Number(item.amount || 0)
      if (account && balance < amount) {
        alerts.push({
          id: `recurring-funding-${item.id}`,
          severity: 'warning',
          kind: 'cash',
          title: `${item.name} may not be fully funded`,
          message: `${account.name} has ${item.currency} ${balance.toFixed(2)}, while ${item.currency} ${amount.toFixed(2)} is due by ${item.next_due_date}.`,
          currency: item.currency,
          amount: amount - balance,
          action: 'accounts',
        })
      }
    }
  }

  const goals = await getGoalOverview(userId, false)
  const thirtyDays = new Date(`${today}T00:00:00Z`)
  thirtyDays.setUTCDate(thirtyDays.getUTCDate() + 30)
  const thirtyIso = toIsoDate(thirtyDays)
  for (const goal of goals.goals.filter((row) => !row.is_archived && row.status !== 'Completed' && row.target_date)) {
    const percent = Number(goal.percent_complete || 0)
    if (goal.target_date < today) {
      alerts.push({
        id: `goal-overdue-${goal.id}`,
        severity: 'warning',
        kind: 'goal',
        title: `${goal.name} passed its target date`,
        message: `${percent.toFixed(1)}% complete with ${goal.currency} ${Number(goal.remaining).toFixed(2)} still remaining.`,
        currency: goal.currency,
        amount: Number(goal.remaining),
        action: 'goals',
      })
    } else if (goal.target_date <= thirtyIso && percent < 80) {
      alerts.push({
        id: `goal-due-soon-${goal.id}`,
        severity: 'info',
        kind: 'goal',
        title: `${goal.name} is approaching its target date`,
        message: `${percent.toFixed(1)}% complete; target date is ${goal.target_date}.`,
        currency: goal.currency,
        amount: Number(goal.remaining),
        action: 'goals',
      })
    }
  }

  const spikeResult = await pool.query(
    `WITH current_month AS (
       SELECT category_id, currency, SUM(amount)::numeric(18,2) AS spent
       FROM finance_transactions
       WHERE user_id = $1 AND transaction_type = 'Expense'
         AND transaction_date >= date_trunc('month', CURRENT_DATE)::date
         AND transaction_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
       GROUP BY category_id, currency
     ), prior AS (
       SELECT category_id, currency,
              (SUM(amount) / 3.0)::numeric(18,2) AS avg_monthly
       FROM finance_transactions
       WHERE user_id = $1 AND transaction_type = 'Expense'
         AND transaction_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date
         AND transaction_date < date_trunc('month', CURRENT_DATE)::date
       GROUP BY category_id, currency
     )
     SELECT c.id AS category_id, c.name AS category_name, cm.currency, cm.spent, p.avg_monthly
     FROM current_month cm
     JOIN prior p ON p.category_id = cm.category_id AND p.currency = cm.currency
     JOIN finance_categories c ON c.id = cm.category_id AND c.user_id = $1
     WHERE p.avg_monthly > 0 AND cm.spent >= p.avg_monthly * 1.5
     ORDER BY (cm.spent / NULLIF(p.avg_monthly, 0)) DESC
     LIMIT 5`,
    [userId],
  )

  for (const row of spikeResult.rows) {
    const spent = Number(row.spent || 0)
    const average = Number(row.avg_monthly || 0)
    const change = average > 0 ? ((spent / average) - 1) * 100 : 0
    alerts.push({
      id: `spike-${row.category_id}-${row.currency}`,
      severity: 'info',
      kind: 'insight',
      title: `${row.category_name} spending is unusually high`,
      message: `This month is ${change.toFixed(0)}% above the prior 3-month average (${row.currency} ${average.toFixed(2)}).`,
      currency: row.currency,
      amount: spent,
      action: 'transactions',
    })
  }

  const rank = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.title.localeCompare(b.title))
  const summary = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  }
  return { generatedAt: new Date().toISOString(), summary, alerts }
}

router.get('/alerts', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Database is not configured' })
  try {
    return res.json(await getAlertsOverview(req.auth.userId))
  } catch (error) {
    console.error('Financial alerts lookup failed:', error)
    return res.status(500).json({ message: 'Could not generate financial alerts' })
  }
})

export default router
