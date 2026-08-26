import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { safeCsvCell } from '../utils/csv.js'

function isoLocal(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function initialRange() {
  const now = new Date()
  return {
    from: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoLocal(now),
    currency: 'GHS',
  }
}

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
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

function monthLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GH', { month: 'short', year: 'numeric' })
    .format(new Date(`${value}-01T00:00:00`))
}

function presetRange(name) {
  const now = new Date()
  const today = isoLocal(now)
  if (name === 'this-month') {
    return { from: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  if (name === 'last-month') {
    return {
      from: isoLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoLocal(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  if (name === 'ytd') {
    return { from: `${now.getFullYear()}-01-01`, to: today }
  }
  if (name === 'last-12-months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    return { from: isoLocal(start), to: today }
  }
  return { from: initialRange().from, to: today }
}

function csvForTransactions(transactions) {
  const headers = [
    'Date', 'Type', 'Account', 'Destination Account', 'Category', 'Description', 'Notes',
    'Amount', 'Currency', 'Cash Flow Impact',
  ]
  const rows = transactions.map((tx) => {
    const amount = Number(tx.amount || 0)
    const impact = tx.transaction_type === 'Income' ? amount : tx.transaction_type === 'Expense' ? -amount : 0
    return [
      String(tx.transaction_date || '').slice(0, 10),
      tx.transaction_type,
      tx.account_name,
      tx.transfer_account_name || '',
      tx.category_name || '',
      tx.description || '',
      tx.notes || '',
      amount.toFixed(2),
      tx.currency,
      impact.toFixed(2),
    ]
  })
  return [headers, ...rows].map((row) => row.map(safeCsvCell).join(',')).join('\r\n')
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [filters, setFilters] = useState(initialRange)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadReport(nextFilters = filters) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams(nextFilters)
      const data = await apiRequest(`/api/finance/reports?${params.toString()}`)
      setReport(data)
      setFilters(data.filters)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport(initialRange())
    // Initial report only. Subsequent loads are explicit so changing a date does not query on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableCurrencies = useMemo(() => {
    const values = new Set(['GHS', ...(report?.availableCurrencies || [])])
    return Array.from(values).sort()
  }, [report])

  function applyPreset(name) {
    const range = presetRange(name)
    const next = { ...filters, ...range }
    setFilters(next)
    loadReport(next)
  }

  function submit(event) {
    event.preventDefault()
    loadReport(filters)
  }

  function exportCsv() {
    if (!report?.transactions?.length) return
    const { from, to, currency } = report.filters
    const csv = `\ufeff${csvForTransactions(report.transactions)}`
    downloadText(`finance-transactions-${currency}-${from}-to-${to}.csv`, csv, 'text/csv;charset=utf-8')
  }

  function printReport() {
    window.print()
  }

  const summary = report?.summary || {}
  const maxMonthly = Math.max(1, ...(report?.monthly || []).flatMap((row) => [Number(row.income || 0), Number(row.expenses || 0)]))

  return (
    <section className="reports-workspace">
      <div className="section-heading-row reports-heading-row report-no-print">
        <div>
          <p className="eyebrow">REPORTS · EXPORT · PRINT</p>
          <h1>Financial reports</h1>
          <p className="muted">Build a date-range statement directly from your ledger, then export the transaction detail or print the report.</p>
        </div>
        <div className="report-actions">
          <button className="secondary-button" onClick={exportCsv} disabled={!report?.transactions?.length}>Download CSV</button>
          <button className="primary-button" onClick={printReport} disabled={!report}>Print / Save PDF</button>
        </div>
      </div>

      <form className="report-controls report-no-print" onSubmit={submit}>
        <div className="report-presets" aria-label="Report presets">
          <button type="button" onClick={() => applyPreset('this-month')}>This month</button>
          <button type="button" onClick={() => applyPreset('last-month')}>Last month</button>
          <button type="button" onClick={() => applyPreset('ytd')}>Year to date</button>
          <button type="button" onClick={() => applyPreset('last-12-months')}>Last 12 months</button>
        </div>
        <label>From<input type="date" required value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>To<input type="date" required value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label>Currency
          <select value={filters.currency} onChange={(event) => setFilters({ ...filters, currency: event.target.value })}>
            {availableCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit">Generate report</button>
      </form>

      {error && <p className="error-message dashboard-error report-no-print">{error}</p>}
      {loading && <div className="empty-state report-no-print"><strong>Generating report…</strong></div>}

      {!loading && report && (
        <div className="report-print-area">
          <header className="print-report-header">
            <div>
              <p className="eyebrow">KORA MONEY</p>
              <h1>Cash Flow Report</h1>
              <p>{dateLabel(report.filters.from)} — {dateLabel(report.filters.to)} · {report.filters.currency}</p>
            </div>
            <div className="print-report-meta">
              <span>Generated</span>
              <strong>{new Date(report.generatedAt).toLocaleString('en-GH')}</strong>
            </div>
          </header>

          <div className="report-metric-grid">
            <article><span>Income</span><strong className="amount-income">{money(summary.income, report.filters.currency)}</strong><small>{summary.incomeCount || 0} entries</small></article>
            <article><span>Expenses</span><strong className="amount-expense">{money(summary.expenses, report.filters.currency)}</strong><small>{summary.expenseCount || 0} entries</small></article>
            <article><span>Net cash flow</span><strong>{money(summary.netCashFlow, report.filters.currency)}</strong><small>{Number(summary.savingsRate || 0).toFixed(1)}% cash-flow savings rate</small></article>
            <article><span>Transfers</span><strong>{money(summary.transferVolume, report.filters.currency)}</strong><small>{summary.transferCount || 0} internal movements</small></article>
          </div>

          <section className="report-grid report-overview-grid">
            <article className="panel report-panel">
              <div className="panel-heading-row">
                <div><p className="eyebrow">PERIOD TREND</p><h2>Monthly cash flow</h2></div>
                <span className="analytics-period-label">{report.monthly.length} month{report.monthly.length === 1 ? '' : 's'}</span>
              </div>
              {report.monthly.length ? (
                <div className="report-month-list">
                  {report.monthly.map((row) => (
                    <div className="report-month-row" key={row.month}>
                      <strong>{monthLabel(row.month)}</strong>
                      <div className="report-mini-bars" aria-hidden="true">
                        <span className="income" style={{ width: `${Math.max(2, (Number(row.income || 0) / maxMonthly) * 100)}%` }} />
                        <span className="expense" style={{ width: `${Math.max(2, (Number(row.expenses || 0) / maxMonthly) * 100)}%` }} />
                      </div>
                      <div className="report-month-values"><span>{money(row.income, report.filters.currency)} in</span><span>{money(row.expenses, report.filters.currency)} out</span><strong>{money(row.netCashFlow, report.filters.currency)} net</strong></div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-inline">No cash-flow transactions in this period.</div>}
            </article>

            <article className="panel report-panel">
              <p className="eyebrow">REPORT SUMMARY</p>
              <h2>Statement facts</h2>
              <div className="analytics-stat-list report-facts">
                <div><span>Total ledger entries</span><strong>{summary.totalEntries || 0}</strong></div>
                <div><span>Income transactions</span><strong>{summary.incomeCount || 0}</strong></div>
                <div><span>Expense transactions</span><strong>{summary.expenseCount || 0}</strong></div>
                <div><span>Transfer transactions</span><strong>{summary.transferCount || 0}</strong></div>
              </div>
              <p className="report-definition">Transfers are shown for account movement visibility but are excluded from income, expenses and net cash flow.</p>
            </article>
          </section>

          <section className="report-grid report-category-grid">
            <article className="panel report-panel">
              <p className="eyebrow">EXPENSE BREAKDOWN</p>
              <h2>Where money went</h2>
              {report.expenseCategories.length ? (
                <div className="report-category-list">
                  {report.expenseCategories.map((row) => (
                    <div className="report-category-row" key={row.categoryId}>
                      <div><strong>{row.categoryName}</strong><span>{row.transactionCount} transaction{row.transactionCount === 1 ? '' : 's'} · {row.share}%</span></div>
                      <strong>{money(row.amount, report.filters.currency)}</strong>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-inline">No expenses in this period.</div>}
            </article>

            <article className="panel report-panel">
              <p className="eyebrow">INCOME BREAKDOWN</p>
              <h2>Where money came from</h2>
              {report.incomeCategories.length ? (
                <div className="report-category-list">
                  {report.incomeCategories.map((row) => (
                    <div className="report-category-row" key={row.categoryId}>
                      <div><strong>{row.categoryName}</strong><span>{row.transactionCount} transaction{row.transactionCount === 1 ? '' : 's'} · {row.share}%</span></div>
                      <strong>{money(row.amount, report.filters.currency)}</strong>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-inline">No income in this period.</div>}
            </article>
          </section>

          <section className="panel report-panel">
            <div className="panel-heading-row">
              <div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2>Money movement by account</h2></div>
              <span className="analytics-period-label">{report.filters.currency}</span>
            </div>
            {report.accountActivity.length ? (
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr><th>Account</th><th>Type</th><th className="number-cell">Inflow</th><th className="number-cell">Outflow</th><th className="number-cell">Net movement</th></tr></thead>
                  <tbody>
                    {report.accountActivity.map((row) => (
                      <tr key={row.accountId}>
                        <td><strong>{row.accountName}</strong>{row.isArchived && <small>Archived</small>}</td>
                        <td>{row.accountType}</td>
                        <td className="number-cell amount-income">{money(row.inflow, report.filters.currency)}</td>
                        <td className="number-cell amount-expense">{money(row.outflow, report.filters.currency)}</td>
                        <td className="number-cell"><strong>{money(row.netMovement, report.filters.currency)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-inline">No account movement in this period.</div>}
          </section>

          <section className="panel report-panel transaction-statement-panel">
            <div className="panel-heading-row">
              <div><p className="eyebrow">TRANSACTION STATEMENT</p><h2>Ledger detail</h2></div>
              <span className="analytics-period-label">{report.transactions.length} entries</span>
            </div>
            {report.transactions.length ? (
              <div className="report-table-wrap">
                <table className="report-table transaction-statement-table">
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Description</th><th>Account / Movement</th><th>Category</th><th className="number-cell">Amount</th></tr>
                  </thead>
                  <tbody>
                    {report.transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{dateLabel(tx.transaction_date)}</td>
                        <td><span className={`type-chip ${tx.transaction_type.toLowerCase()}`}>{tx.transaction_type}</span></td>
                        <td><strong>{tx.description || tx.category_name || 'Transfer'}</strong>{tx.notes && <small>{tx.notes}</small>}</td>
                        <td>{tx.transaction_type === 'Transfer' ? `${tx.account_name} → ${tx.transfer_account_name}` : tx.account_name}</td>
                        <td>{tx.category_name || '—'}</td>
                        <td className={`number-cell ${tx.transaction_type === 'Income' ? 'amount-income' : tx.transaction_type === 'Expense' ? 'amount-expense' : ''}`}>
                          <strong>{tx.transaction_type === 'Income' ? '+' : tx.transaction_type === 'Expense' ? '−' : ''}{money(tx.amount, tx.currency)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-inline">No transactions in this report period.</div>}
            {report.truncated && <p className="report-definition">This on-screen/export report is limited to the first {report.transactionLimit.toLocaleString()} entries for a single request. Narrow the date range if necessary.</p>}
          </section>

          <footer className="print-report-footer">
            <span>Kora Money · Cash Flow Report</span>
            <span>{report.filters.currency} · {report.filters.from} to {report.filters.to}</span>
          </footer>
        </div>
      )}
    </section>
  )
}
