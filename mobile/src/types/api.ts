export type User = { id: number; name: string; email: string; createdAt: string }

export type MoneyRow = { currency: string; balance?: string; income?: string; expenses?: string; net_cash_flow?: string }

export type Account = {
  id: number
  name: string
  account_type: string
  currency: string
  opening_balance: string
  current_balance: string
  transaction_count: number
  is_archived: boolean
}

export type Transaction = {
  id: number
  transaction_type: 'Income' | 'Expense' | 'Transfer'
  amount: string
  currency: string
  description: string
  transaction_date: string
  account_name: string
  transfer_account_name?: string | null
  category_name?: string | null
}

export type Foundation = {
  accounts: number
  activeAccounts: number
  balances: MoneyRow[]
  monthly: MoneyRow[]
  defaultCurrency: string
}

export type AccountsResponse = { accounts: Account[]; balances: MoneyRow[]; activeCount: number; archivedCount: number }
export type TransactionsResponse = { transactions: Transaction[]; monthly: MoneyRow[] }

export type Budget = { id: number; category_name: string; amount: string; spent: string; remaining: string; percent_used: number }
export type BudgetResponse = {
  month: string
  currency: string
  budgets: Budget[]
  summary: {
    totalBudget: string
    totalExpenses: string
    remaining: string
    percentUsed: number
    budgetCount: number
    unbudgetedSpent: string
  }
}
