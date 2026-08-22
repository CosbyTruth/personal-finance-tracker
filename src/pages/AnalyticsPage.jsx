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

function monthLabel(value) {
  if (!value) return ''
  const [year, month] = String(value).split('-').map(Number)
  return new Intl.DateTimeFormat('en-GH', { month: 'short', year: '2-digit' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function changeText(value, { inverse = false } = {}) {
  if (value === null || value === undefined) return 'No prior-month baseline'
  const numeric = Number(value)
  if (numeric === 0) return 'No change vs last month'
  const direction = numeric > 0 ? 'up' : 'down'
  const favorable = inverse ? numeric < 0 : numeric > 0
  return `${Math.abs(numeric).toFixed(1)}% ${direction} vs last month${favorable ? ' · favorable' : ''}`
}

function ChangeNote({ value, inverse = false }) {
  if (value === null || value === undefined) return <small className="analytics-change neutral">No prior-month baseline</small>
  const numeric = Number(value)
  const favorable = inverse ? numeric < 0 : numeric > 0
  const className = numeric === 0 ? 'neutral' : favorable ? 'good' : 'bad'
  return <small className={`analytics-change ${className}`}>{changeText(value, { inverse })}</small>
}

function EmptyChart({ children }) {
  return <div className="analytics-empty">{children}</div>
}

export default function AnalyticsPage() {
  const [currency, setCurrency] = useState('GHS')
  const [months, setMonths] = useState(6)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiRequest(`/api/finance/analytics?currency=${encodeURIComponent(currency)}&months=${months}`)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setLoading(false)
          if (!payload.availableCurrencies?.includes(currency) && payload.availableCurrencies?.length) {
            setCurrency(payload.availableCurrencies[0])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [currency, months])

  const maxFlow = useMemo(() => {
    if (!data?.trend?.length) return 1
    return Math.max(1, ...data.trend.flatMap((row) => [Number(row.income || 0), Number(row.expenses || 0)]))
  }, [data])

  const maxCategory = useMemo(() => {
    if (!data?.categories?.length) return 1
    return Math.max(1, ...data.categories.map((row) => Number(row.spent || 0)))
  }, [data])

  const totalAccountMagnitude = useMemo(() => {
    if (!data?.accountsByType?.length) return 1
    return Math.max(1, data.accountsByType.reduce((sum, row) => sum + Math.abs(Number(row.balance || 0)), 0))
  }, [data])

  const topCategory = data?.categories?.[0]
  const current = data?.current || {}
  const budget = data?.budget || {}
  const goals = data?.goals || {}
  const recurring = data?.recurring30 || {}

  return (
    <section className="analytics-workspace">
      <div className="section-heading-row analytics-heading-row">
        <div>
          <p className="eyebrow">MILESTONE 7 · FINANCIAL ANALYTICS</p>
          <h1>See what your money is doing.</h1>
          <p className="muted">Every chart is derived from your transaction ledger, account balances, budgets and goals. Transfers are excluded from income and spending analytics.</p>
        </div>
        <div className="analytics-filters">
          <label>Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {(data?.availableCurrencies?.length ? data.availableCurrencies : ['GHS', 'USD', 'GBP', 'EUR']).map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label>Trend range
            <select value={months} onChange={(event) => setMonths(Number(event.target.value))}>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </label>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <div className="panel analytics-loading">Loading financial analytics…</div>}

      {!loading && data && (
        <>
          <section className="analytics-metric-grid">
            <article className="analytics-metric-card">
              <span>Income this month</span>
              <strong>{money(current.income, currency)}</strong>
              <ChangeNote value={data.comparison?.incomeChange} />
            </article>
            <article className="analytics-metric-card">
              <span>Expenses this month</span>
              <strong>{money(current.expenses, currency)}</strong>
              <ChangeNote value={data.comparison?.expenseChange} inverse />
            </article>
            <article className="analytics-metric-card">
              <span>Net cash flow</span>
              <strong className={Number(current.netCashFlow || 0) < 0 ? 'amount-expense' : ''}>{money(current.netCashFlow, currency)}</strong>
              <ChangeNote value={data.comparison?.netChange} />
            </article>
            <article className="analytics-metric-card accent">
              <span>Cash-flow savings rate</span>
              <strong>{Number(current.savingsRate || 0).toFixed(1)}%</strong>
              <small>Net cash flow ÷ income</small>
            </article>
          </section>

          <section className="analytics-main-grid">
            <article className="panel analytics-trend-panel">
              <div className="panel-heading-row">
                <div><p className="eyebrow">CASH FLOW TREND</p><h2>Income vs expenses</h2></div>
                <span className="analytics-period-label">Last {months} months</span>
              </div>
              {data.trend?.some((row) => Number(row.income) || Number(row.expenses)) ? (
                <div className="flow-chart" role="img" aria-label={`Income and expense trend for the last ${months} months`}>
                  {data.trend.map((row) => (
                    <div className="flow-chart-column" key={row.month}>
                      <div className="flow-bars">
                        <span className="flow-bar income" title={`Income ${money(row.income, currency)}`} style={{ height: `${Math.max(2, (Number(row.income || 0) / maxFlow) * 100)}%` }} />
                        <span className="flow-bar expense" title={`Expenses ${money(row.expenses, currency)}`} style={{ height: `${Math.max(2, (Number(row.expenses || 0) / maxFlow) * 100)}%` }} />
                      </div>
                      <strong>{monthLabel(row.month)}</strong>
                      <small className={Number(row.netCashFlow) < 0 ? 'amount-expense' : ''}>{money(row.netCashFlow, currency)} net</small>
                    </div>
                  ))}
                </div>
              ) : <EmptyChart>Add income and expense transactions to build your trend.</EmptyChart>}
              <div className="chart-legend"><span><i className="legend-dot income" />Income</span><span><i className="legend-dot expense" />Expenses</span></div>
            </article>

            <article className="panel analytics-average-panel">
              <p className="eyebrow">PERIOD AVERAGES</p>
              <h2>Your monthly baseline</h2>
              <div className="analytics-stat-list">
                <div><span>Average income</span><strong>{money(data.averages?.income, currency)}</strong></div>
                <div><span>Average expenses</span><strong>{money(data.averages?.expenses, currency)}</strong></div>
                <div><span>Average net cash flow</span><strong className={Number(data.averages?.netCashFlow || 0) < 0 ? 'amount-expense' : ''}>{money(data.averages?.netCashFlow, currency)}</strong></div>
                <div><span>Cash-flow entries this month</span><strong>{current.transactionCount || 0}</strong></div>
              </div>
            </article>
          </section>

          <section className="analytics-main-grid">
            <article className="panel">
              <div className="panel-heading-row">
                <div><p className="eyebrow">SPENDING BREAKDOWN</p><h2>Where your money went this month</h2></div>
                {topCategory && <span className="analytics-period-label">Top: {topCategory.category_name}</span>}
              </div>
              {data.categories?.length ? (
                <div className="category-analytics-list">
                  {data.categories.map((row) => (
                    <div className="category-analytics-row" key={row.category_id}>
                      <div className="category-analytics-copy"><strong>{row.category_name}</strong><span>{row.share}% · {row.transactionCount} transaction{row.transactionCount === 1 ? '' : 's'}</span></div>
                      <strong>{money(row.spent, currency)}</strong>
                      <div className="analytics-track"><span style={{ width: `${Math.max(2, (Number(row.spent || 0) / maxCategory) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : <EmptyChart>No expense transactions in {currency} this month.</EmptyChart>}
            </article>

            <article className="panel">
              <p className="eyebrow">ACCOUNT MIX</p>
              <h2>Where your {currency} balance sits</h2>
              {data.accountsByType?.length ? (
                <div className="account-mix-list">
                  {data.accountsByType.map((row) => {
                    const share = totalAccountMagnitude > 0 ? (Math.abs(Number(row.balance || 0)) / totalAccountMagnitude) * 100 : 0
                    return (
                      <div className="account-mix-row" key={row.accountType}>
                        <div><strong>{row.accountType}</strong><span>{row.accounts} account{row.accounts === 1 ? '' : 's'}</span></div>
                        <strong className={Number(row.balance) < 0 ? 'amount-expense' : ''}>{money(row.balance, currency)}</strong>
                        <div className="analytics-track neutral-track"><span style={{ width: `${Math.max(2, share)}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              ) : <EmptyChart>No active {currency} accounts yet.</EmptyChart>}
            </article>
          </section>

          <section className="analytics-health-grid">
            <article className="panel analytics-health-card">
              <p className="eyebrow">BUDGET HEALTH</p>
              <h2>{Number(budget.summary?.percentUsed || 0).toFixed(1)}% used</h2>
              <div className="analytics-track large"><span className={Number(budget.summary?.percentUsed || 0) > 100 ? 'danger' : Number(budget.summary?.percentUsed || 0) >= 80 ? 'warning' : ''} style={{ width: `${Math.min(100, Math.max(0, Number(budget.summary?.percentUsed || 0)))}%` }} /></div>
              <div className="health-detail-grid">
                <div><span>Budget</span><strong>{money(budget.summary?.totalBudget, currency)}</strong></div>
                <div><span>Spent</span><strong>{money(budget.summary?.totalExpenses, currency)}</strong></div>
                <div><span>Over budget</span><strong>{budget.overBudgetCount || 0}</strong></div>
                <div><span>Unbudgeted</span><strong>{money(budget.summary?.unbudgetedSpent, currency)}</strong></div>
              </div>
            </article>

            <article className="panel analytics-health-card">
              <p className="eyebrow">SAVINGS GOALS</p>
              <h2>{Number(goals.percentComplete || 0).toFixed(1)}% funded</h2>
              <div className="analytics-track large"><span style={{ width: `${Math.min(100, Math.max(0, Number(goals.percentComplete || 0)))}%` }} /></div>
              <div className="health-detail-grid">
                <div><span>Saved</span><strong>{money(goals.saved, currency)}</strong></div>
                <div><span>Target</span><strong>{money(goals.target, currency)}</strong></div>
                <div><span>Active goals</span><strong>{goals.activeCount || 0}</strong></div>
                <div><span>Completed</span><strong>{goals.completedCount || 0}</strong></div>
              </div>
            </article>

            <article className="panel analytics-health-card">
              <p className="eyebrow">NEXT SCHEDULED CASH FLOW</p>
              <h2 className={Number(recurring.net || 0) < 0 ? 'amount-expense' : ''}>{money(recurring.net, currency)} net</h2>
              <p className="muted analytics-card-copy">Based on the next due occurrence for active recurring items within 30 days.</p>
              <div className="health-detail-grid three">
                <div><span>Income</span><strong>{money(recurring.income, currency)}</strong></div>
                <div><span>Expenses</span><strong>{money(recurring.expenses, currency)}</strong></div>
                <div><span>Due items</span><strong>{recurring.dueItems || 0}</strong></div>
              </div>
            </article>
          </section>

          <section className="panel analytics-insights-panel">
            <div className="panel-heading-row"><div><p className="eyebrow">AUTOMATIC READOUT</p><h2>What the numbers currently say</h2></div></div>
            <div className="insight-grid">
              <div>
                <span>01</span>
                <strong>Cash flow</strong>
                <p>{Number(current.netCashFlow || 0) >= 0 ? `You are positive by ${money(current.netCashFlow, currency)} this month.` : `You are negative by ${money(Math.abs(Number(current.netCashFlow || 0)), currency)} this month.`}</p>
              </div>
              <div>
                <span>02</span>
                <strong>Largest expense category</strong>
                <p>{topCategory ? `${topCategory.category_name} accounts for ${topCategory.share}% of this month's ${currency} spending.` : 'No expense category has spending yet this month.'}</p>
              </div>
              <div>
                <span>03</span>
                <strong>Budget position</strong>
                <p>{budget.overBudgetCount ? `${budget.overBudgetCount} budget ${budget.overBudgetCount === 1 ? 'category is' : 'categories are'} over limit.` : budget.summary?.budgetCount ? 'No budget category is currently over its limit.' : 'No budget has been set for this currency this month.'}</p>
              </div>
              <div>
                <span>04</span>
                <strong>Goal progress</strong>
                <p>{goals.activeCount ? `${money(goals.saved, currency)} is allocated across ${goals.activeCount} active savings goal${goals.activeCount === 1 ? '' : 's'}.` : `No active ${currency} savings goals yet.`}</p>
              </div>
            </div>
          </section>

          <section className="architecture-panel analytics-rule-panel">
            <p className="eyebrow">ANALYTICS RULE</p>
            <div className="formula-grid analytics-formula">
              <div><strong>Transactions</strong><span>Income and expense ledger entries</span></div>
              <span className="formula-sign">+</span>
              <div><strong>Budgets & goals</strong><span>Plans and allocation targets</span></div>
              <span className="formula-sign">→</span>
              <div><strong>Analytics</strong><span>Derived views only; no duplicate financial truth</span></div>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
