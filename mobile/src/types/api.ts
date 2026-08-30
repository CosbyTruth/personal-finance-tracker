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

export type Category = {
  id: number
  name: string
  category_type: 'Income' | 'Expense'
  is_default: boolean
}

export type Transaction = {
  id: number
  transaction_type: 'Income' | 'Expense' | 'Transfer'
  account_id?: number
  category_id?: number | null
  transfer_account_id?: number | null
  amount: string
  currency: string
  description: string
  notes?: string
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
export type TransactionsResponse = { transactions: Transaction[]; accounts: Account[]; categories: Category[]; monthly: MoneyRow[] }

export type Budget = { id: number; category_id: number; category_name: string; budget_month: string; currency: string; amount: string; spent: string; remaining: string; percent_used: number }
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

export type RecurringItem = {
  id: number
  name: string
  transaction_type: 'Income' | 'Expense'
  account_id: number
  category_id: number
  amount: string
  currency: string
  frequency: 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly'
  next_due_date: string
  end_date?: string | null
  anchor_day?: number | null
  notes: string
  is_active: boolean
  account_name: string
  account_type: string
  account_archived: boolean
  category_name: string
  occurrence_count: number
  posted_count: number
  skipped_count: number
  last_processed_date?: string | null
  due_status: 'Paused' | 'Ended' | 'Overdue' | 'Due Today' | 'Upcoming'
}

export type RecurringSummary = {
  active: number
  paused: number
  overdue: number
  dueToday: number
  dueNext30Days: number
  byCurrency: Array<{ currency: string; income30: string; expenses30: string; net30: string; dueItems30: number }>
}

export type RecurringResponse = {
  items: RecurringItem[]
  summary: RecurringSummary
  accounts: Account[]
  categories: Category[]
}

export type AnalyticsTrend = {
  month: string
  income: number
  expenses: number
  netCashFlow: number
  transactionCount: number
}

export type AnalyticsResponse = {
  currency: string
  months: 3 | 6 | 12
  availableCurrencies: string[]
  current: AnalyticsTrend & { savingsRate: number }
  previous: AnalyticsTrend
  comparison: { incomeChange: number | null; expenseChange: number | null; netChange: number | null }
  averages: { income: number; expenses: number; netCashFlow: number }
  trend: AnalyticsTrend[]
  categories: Array<{ category_id: number; category_name: string; spent: number; transactionCount: number; share: number }>
  accountsByType: Array<{ accountType: string; balance: number; accounts: number }>
  budget: {
    summary: BudgetResponse['summary']
    rows: Budget[]
    unbudgeted: unknown[]
    overBudgetCount: number
    watchBudgetCount: number
  }
  goals: { activeCount: number; completedCount: number; target: number; saved: number; remaining: number; percentComplete: number }
  recurring30: { dueItems: number; income: number; expenses: number; net: number }
}

export type ReportCategory = {
  transactionType: 'Income' | 'Expense'
  categoryId: number
  categoryName: string
  amount: number
  transactionCount: number
  share: number
}

export type ReportTransaction = Transaction & { notes?: string }

export type ReportResponse = {
  filters: { from: string; to: string; currency: string }
  availableCurrencies: string[]
  summary: {
    income: number
    expenses: number
    netCashFlow: number
    transferVolume: number
    savingsRate: number
    incomeCount: number
    expenseCount: number
    transferCount: number
    totalEntries: number
  }
  incomeCategories: ReportCategory[]
  expenseCategories: ReportCategory[]
  accountActivity: Array<{ accountId: number; accountName: string; accountType: string; isArchived: boolean; inflow: number; outflow: number; netMovement: number }>
  monthly: Array<{ month: string; income: number; expenses: number; netCashFlow: number; totalEntries: number }>
  transactions: ReportTransaction[]
  generatedAt: string
  transactionLimit: number
  truncated: boolean
}

export type FinancialAlert = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  kind: 'account' | 'budget' | 'recurring' | 'cash' | 'goal' | 'insight'
  title: string
  message: string
  currency: string
  amount: number
  action: 'accounts' | 'budgets' | 'recurring' | 'goals' | 'transactions'
}

export type AlertsResponse = {
  generatedAt: string
  summary: { total: number; critical: number; warning: number; info: number }
  alerts: FinancialAlert[]
}

export type GoalEntry = {
  id: number
  goal_id: number
  entry_type: 'Contribution' | 'Withdrawal'
  amount: string
  contribution_date: string
  notes: string
}

export type Goal = {
  id: number
  name: string
  goal_type: string
  currency: string
  target_amount: string
  starting_amount: string
  current_saved: string
  remaining: string
  percent_complete: number
  target_date?: string | null
  priority: 'Low' | 'Medium' | 'High'
  notes?: string
  status: 'Completed' | 'In Progress'
  is_archived: boolean
  entry_count: number
  entries: GoalEntry[]
}

export type GoalSummary = { currency: string; target: string; saved: string; remaining: string; goals: number; completed: number; percentComplete: number }
export type GoalsResponse = { goals: Goal[]; summary: GoalSummary[] }
