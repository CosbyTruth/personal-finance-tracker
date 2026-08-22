import { pool } from './db.js'

export const DEFAULT_FINANCE_CATEGORIES = [
  ['Salary', 'Income'],
  ['Business Income', 'Income'],
  ['Trading Income', 'Income'],
  ['Other Income', 'Income'],
  ['Food', 'Expense'],
  ['Transport', 'Expense'],
  ['Housing', 'Expense'],
  ['Utilities', 'Expense'],
  ['Health', 'Expense'],
  ['Education', 'Expense'],
  ['Entertainment', 'Expense'],
  ['Family', 'Expense'],
  ['Business', 'Expense'],
  ['Other Expense', 'Expense'],
]

export async function ensureDefaultFinanceCategories(userId) {
  if (!pool) return

  for (const [name, categoryType] of DEFAULT_FINANCE_CATEGORIES) {
    await pool.query(
      `INSERT INTO finance_categories (user_id, name, category_type, is_default)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT DO NOTHING`,
      [userId, name, categoryType],
    )
  }
}
