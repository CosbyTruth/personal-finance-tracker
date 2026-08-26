import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

function money(amount, currency) {
  const value = Number(amount || 0)
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function dateLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

export default function DashboardPage({ onOpenAccounts, onOpenTransactions, onOpenBudgets, onOpenGoals, onOpenRecurring, onOpenAnalytics, onOpenReports, onOpenAlerts }) {
  const [foundation, setFoundation] = useState(null)
  const [summary, setSummary] = useState(null)
  const [budgetData, setBudgetData] = useState(null)
  const [goalData, setGoalData] = useState(null)
  const [recurringData, setRecurringData] = useState(null)
  const [alertsData, setAlertsData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7)
    Promise.all([
      apiRequest('/api/finance/foundation'),
      apiRequest('/api/finance/transactions/summary'),
      apiRequest(`/api/finance/budgets?month=${month}&currency=GHS`),
      apiRequest('/api/finance/goals?includeArchived=false'),
      apiRequest('/api/finance/recurring?includeInactive=false'),
      apiRequest('/api/finance/alerts'),
    ])
      .then(([foundationData, summaryData, budgets, goals, recurring, alerts]) => {
        setFoundation(foundationData)
        setSummary(summaryData)
        setBudgetData(budgets)
        setGoalData(goals)
        setRecurringData(recurring)
        setAlertsData(alerts)
      })
      .catch((err) => setError(err.message))
  }, [])

  const ghsBalance = foundation?.balances?.find((item) => item.currency === 'GHS')
  const ghsMonth = foundation?.monthly?.find((item) => item.currency === 'GHS')
  const monthlyRows = useMemo(() => foundation?.monthly || [], [foundation])

  return (
    <>
      <section className="hero-panel account-hero dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">YOUR MONEY TODAY</p>
          <h1>Clear finances.<br />Calmer decisions.</h1>
          <p className="lead">See your balance, spending and progress in one simple view. Every figure comes directly from your secure ledger.</p>
          <div className="hero-button-row">
            <button className="primary-button hero-action" onClick={() => onOpenTransactions('Expense')}>+ Add expense</button>
            <button className="secondary-button hero-action" onClick={() => onOpenTransactions('Income')}>+ Add income</button>
            <button className="secondary-button hero-action" onClick={onOpenAnalytics}>View insights</button>
          </div>
        </div>
        <div className="dashboard-balance-graphic">
          <div className="currency-pill">
            <small>AVAILABLE BALANCE</small>
            <strong>{ghsBalance ? money(ghsBalance.balance, 'GHS') : 'GHS 0.00'}</strong>
            <span>Across your active GHS accounts</span>
          </div>
          <div className="balance-graphic-heading"><span>Monthly money flow</span><strong aria-label="Trend is steady">Steady</strong></div>
          <div className="balance-bars" aria-hidden="true">
            <i style={{ height: '34%' }} /><i style={{ height: '48%' }} /><i style={{ height: '43%' }} /><i style={{ height: '62%' }} />
            <i style={{ height: '54%' }} /><i style={{ height: '78%' }} /><i style={{ height: '69%' }} /><i style={{ height: '88%' }} />
          </div>
          <div className="balance-graphic-footer"><span><i />Money in</span><button type="button" onClick={onOpenReports}>Open reports →</button></div>
        </div>
      </section>

      {error && <p className="error-message dashboard-error">{error}</p>}

      <section className="metric-grid">
        <article className="metric-card positive-card"><span>Income this month</span><strong>{money(ghsMonth?.income || 0, 'GHS')}</strong><small>GHS cash inflows</small></article>
        <article className="metric-card negative-card"><span>Expenses this month</span><strong>{money(ghsMonth?.expenses || 0, 'GHS')}</strong><small>GHS spending</small></article>
        <article className="metric-card"><span>Net cash flow</span><strong>{money(ghsMonth?.net_cash_flow || 0, 'GHS')}</strong><small>Income minus expenses</small></article>
        <article className="metric-card accent"><span>Budget used</span><strong>{Number(budgetData?.summary?.percentUsed || 0).toFixed(1)}%</strong><small>{money(budgetData?.summary?.remaining || 0, 'GHS')} remaining</small></article>
      </section>

      <section className="panel dashboard-alerts-panel">
        <div className="panel-heading-row">
          <div><p className="eyebrow">FINANCIAL ATTENTION</p><h2>Alerts & smart insights</h2></div>
          <button className="text-button" onClick={onOpenAlerts}>Review all</button>
        </div>
        <div className="dashboard-alert-summary">
          <div><span>Needs action</span><strong className={Number(alertsData?.summary?.critical || 0) ? 'amount-expense' : ''}>{alertsData?.summary?.critical || 0}</strong></div>
          <div><span>Watch</span><strong>{alertsData?.summary?.warning || 0}</strong></div>
          <div><span>Insights</span><strong>{alertsData?.summary?.info || 0}</strong></div>
        </div>
        {alertsData?.alerts?.length ? (
          <div className="dashboard-alert-list">
            {alertsData.alerts.slice(0, 3).map((alert) => <div className={`dashboard-alert-row ${alert.severity}`} key={alert.id}><span>{alert.title}</span><small>{alert.message}</small></div>)}
          </div>
        ) : <div className="empty-inline budget-dashboard-empty">No current financial alerts. Your existing rules do not flag anything that needs attention.</div>}
      </section>

      <section className="content-grid dashboard-flow-grid">
        <article className="panel">
          <div className="panel-heading-row">
            <div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest transactions</h2></div>
            <button className="text-button" onClick={() => onOpenTransactions()}>View all</button>
          </div>
          <div className="recent-list">
            {summary?.recent?.length ? summary.recent.map((transaction) => (
              <div className="recent-row" key={transaction.id}>
                <div className={`transaction-badge ${transaction.transaction_type.toLowerCase()}`}>
                  {transaction.transaction_type === 'Income' ? '+' : transaction.transaction_type === 'Expense' ? '−' : '↔'}
                </div>
                <div className="recent-copy">
                  <strong>{transaction.description || transaction.category_name || 'Transfer'}</strong>
                  <span>
                    {transaction.transaction_type === 'Transfer'
                      ? `${transaction.account_name} → ${transaction.transfer_account_name}`
                      : `${transaction.account_name} · ${transaction.category_name}`}
                  </span>
                </div>
                <div className="recent-amount">
                  <strong className={transaction.transaction_type === 'Income' ? 'amount-income' : transaction.transaction_type === 'Expense' ? 'amount-expense' : ''}>
                    {transaction.transaction_type === 'Income' ? '+' : transaction.transaction_type === 'Expense' ? '−' : ''}{money(transaction.amount, transaction.currency)}
                  </strong>
                  <span>{dateLabel(transaction.transaction_date)}</span>
                </div>
              </div>
            )) : <div className="empty-inline">No transactions yet. Add your first income or expense.</div>}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">THIS MONTH BY CURRENCY</p>
          <h2>Cash flow stays currency-safe</h2>
          <p className="muted">We do not combine different currencies without a real exchange rate.</p>
          <div className="cashflow-list">
            {monthlyRows.length ? monthlyRows.map((row) => (
              <div className="cashflow-card" key={row.currency}>
                <div><span>{row.currency}</span><strong>{money(row.net_cash_flow, row.currency)}</strong></div>
                <small>Income {money(row.income, row.currency)} · Expenses {money(row.expenses, row.currency)}</small>
              </div>
            )) : <div className="empty-inline">Monthly cash flow will appear after your first transaction.</div>}
          </div>
          <button className="secondary-button full-button" onClick={onOpenAccounts}>Manage accounts</button>
        </article>
      </section>

      <section className="panel dashboard-budget-panel">
        <div className="panel-heading-row">
          <div><p className="eyebrow">THIS MONTH'S BUDGET</p><h2>Spending control</h2></div>
          <button className="text-button" onClick={onOpenBudgets}>Manage budgets</button>
        </div>
        {budgetData?.budgets?.length ? (
          <>
            <div className="dashboard-budget-summary">
              <div><span>Planned</span><strong>{money(budgetData.summary.totalBudget, 'GHS')}</strong></div>
              <div><span>Spent</span><strong>{money(budgetData.summary.totalExpenses, 'GHS')}</strong></div>
              <div><span>Remaining</span><strong className={Number(budgetData.summary.remaining) < 0 ? 'amount-expense' : ''}>{money(budgetData.summary.remaining, 'GHS')}</strong></div>
            </div>
            <div className="dashboard-budget-categories">
              {budgetData.budgets.slice(0, 4).map((budget) => {
                const percent = Math.max(0, Number(budget.percent_used || 0))
                const level = percent > 100 ? 'over' : percent >= 80 ? 'warning' : 'safe'
                return (
                  <div className="dashboard-budget-row" key={budget.id}>
                    <div><strong>{budget.category_name}</strong><span>{money(budget.spent, 'GHS')} / {money(budget.amount, 'GHS')}</span></div>
                    <div className="category-budget-track"><span className={level} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="empty-inline budget-dashboard-empty">No GHS budgets yet. Set category limits to start measuring your monthly spending plan.</div>
        )}
      </section>

      <section className="panel dashboard-goals-panel">
        <div className="panel-heading-row">
          <div><p className="eyebrow">SAVINGS GOALS</p><h2>Targets in progress</h2></div>
          <button className="text-button" onClick={onOpenGoals}>Manage goals</button>
        </div>
        {goalData?.goals?.length ? (
          <>
            <div className="dashboard-goal-summary">
              {(goalData.summary || []).slice(0, 3).map((row) => (
                <div key={row.currency}><span>{row.currency} saved</span><strong>{money(row.saved, row.currency)}</strong><small>{row.percentComplete}% of {money(row.target, row.currency)}</small></div>
              ))}
            </div>
            <div className="dashboard-goals-list">
              {goalData.goals.slice(0, 4).map((goal) => {
                const percent = Math.max(0, Number(goal.percent_complete || 0))
                return (
                  <div className="dashboard-goal-row" key={goal.id}>
                    <div><strong>{goal.name}</strong><span>{money(goal.current_saved, goal.currency)} / {money(goal.target_amount, goal.currency)}</span></div>
                    <div className="goal-progress-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="empty-inline budget-dashboard-empty">No active savings goals yet. Create an emergency fund, purchase target or another financial objective.</div>
        )}
      </section>


      <section className="panel dashboard-recurring-panel">
        <div className="panel-heading-row">
          <div><p className="eyebrow">RECURRING CASH FLOW</p><h2>What is coming next</h2></div>
          <button className="text-button" onClick={onOpenRecurring}>Manage recurring</button>
        </div>
        <div className="dashboard-recurring-summary">
          <div><span>Due today</span><strong>{recurringData?.summary?.dueToday || 0}</strong></div>
          <div><span>Overdue</span><strong className={Number(recurringData?.summary?.overdue || 0) ? 'amount-expense' : ''}>{recurringData?.summary?.overdue || 0}</strong></div>
          <div><span>Next 30 days</span><strong>{recurringData?.summary?.dueNext30Days || 0}</strong></div>
        </div>
        {recurringData?.items?.length ? (
          <div className="dashboard-recurring-list">
            {recurringData.items.slice(0, 4).map((item) => (
              <div className="dashboard-recurring-row" key={item.id}>
                <div className={`transaction-badge ${item.transaction_type.toLowerCase()}`}>{item.transaction_type === 'Income' ? '+' : '−'}</div>
                <div><strong>{item.name}</strong><span>{item.account_name} · {item.frequency} · due {dateLabel(item.next_due_date)}</span></div>
                <strong className={item.transaction_type === 'Income' ? 'amount-income' : 'amount-expense'}>{item.transaction_type === 'Income' ? '+' : '−'}{money(item.amount, item.currency)}</strong>
              </div>
            ))}
          </div>
        ) : <div className="empty-inline budget-dashboard-empty">No active recurring items yet. Add salary, rent, subscriptions or other repeated cash flow.</div>}
      </section>

      <section className="architecture-panel">
        <p className="eyebrow">LEDGER + BUDGET RULES</p>
        <div className="formula-grid">
          <div><strong>Income</strong><span>Adds money to one account</span></div>
          <span className="formula-sign">+</span>
          <div><strong>Expense</strong><span>Reduces one account and counts as spending</span></div>
          <span className="formula-sign">↔</span>
          <div><strong>Transfer</strong><span>Moves money; it is not income or expense</span></div>
          <span className="formula-sign">=</span>
          <div><strong>Live balance</strong><span>Derived from opening balance + ledger history</span></div>
        </div>
      </section>
    </>
  )
}
