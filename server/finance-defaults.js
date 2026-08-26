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

export async function ensureDefaultFinanceCategories(userId, database = pool) {
  if (!database) return

  const names = DEFAULT_FINANCE_CATEGORIES.map(([name]) => name)
  const types = DEFAULT_FINANCE_CATEGORIES.map(([, categoryType]) => categoryType)
  await database.query(
    `INSERT INTO finance_categories (user_id, name, category_type, is_default)
     SELECT $1, seed.name, seed.category_type, TRUE
     FROM UNNEST($2::text[], $3::text[]) AS seed(name, category_type)
     ON CONFLICT DO NOTHING`,
    [userId, names, types],
  )
}
