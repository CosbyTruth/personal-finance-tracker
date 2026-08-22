import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

function severityLabel(value) {
  return value === 'critical' ? 'Needs action' : value === 'warning' ? 'Watch' : 'Insight'
}

export default function AlertsPage({ onNavigate }) {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setData(await apiRequest('/api/finance/alerts'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    const rows = data?.alerts || []
    return filter === 'all' ? rows : rows.filter((row) => row.severity === filter)
  }, [data, filter])

  return (
    <section className="alerts-workspace">
      <div className="section-heading-row alerts-heading-row">
        <div>
          <p className="eyebrow">MILESTONE 9 · ALERTS & SMART INSIGHTS</p>
          <h1>Know what needs attention.</h1>
          <p className="muted">Rules are calculated from your live balances, budgets, recurring schedules, goals and transaction history. These are decision-support signals—not forecasts.</p>
        </div>
        <button className="secondary-button" onClick={load}>Refresh alerts</button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <div className="panel analytics-loading">Checking your financial records…</div>}

      {!loading && data && (
        <>
          <section className="alert-summary-grid">
            <article className="alert-summary-card critical"><span>Needs action</span><strong>{data.summary.critical}</strong><small>High-priority issues</small></article>
            <article className="alert-summary-card warning"><span>Watch</span><strong>{data.summary.warning}</strong><small>Items nearing a limit or due date</small></article>
            <article className="alert-summary-card info"><span>Insights</span><strong>{data.summary.info}</strong><small>Patterns worth reviewing</small></article>
            <article className="alert-summary-card"><span>Total signals</span><strong>{data.summary.total}</strong><small>Generated from current records</small></article>
          </section>

          <div className="alert-filter-row">
            {['all', 'critical', 'warning', 'info'].map((value) => (
              <button key={value} className={filter === value ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter(value)}>
                {value === 'all' ? 'All' : severityLabel(value)}
              </button>
            ))}
          </div>

          <section className="alert-list">
            {visible.length ? visible.map((alert) => (
              <article className={`alert-card ${alert.severity}`} key={alert.id}>
                <div className="alert-severity"><span>{severityLabel(alert.severity)}</span><small>{alert.kind}</small></div>
                <div className="alert-copy"><h2>{alert.title}</h2><p>{alert.message}</p></div>
                {alert.action && <button className="secondary-button compact" onClick={() => onNavigate(alert.action)}>Review</button>}
              </article>
            )) : (
              <div className="panel alert-clear-state">
                <strong>No alerts in this view.</strong>
                <p>Your current records do not trigger any of these rules.</p>
              </div>
            )}
          </section>

          <section className="panel alerts-rule-panel">
            <p className="eyebrow">WHAT IS CHECKED</p>
            <div className="alerts-rule-grid">
              <div><strong>Balances</strong><span>Negative active account balances.</span></div>
              <div><strong>Budgets</strong><span>80%+ usage and categories already over budget.</span></div>
              <div><strong>Recurring</strong><span>Overdue/due-today items and near-term bills that exceed their linked account balance.</span></div>
              <div><strong>Goals</strong><span>Incomplete goals past their target date or approaching it with low progress.</span></div>
              <div><strong>Spending patterns</strong><span>Category spending at least 50% above its prior three-month average.</span></div>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
