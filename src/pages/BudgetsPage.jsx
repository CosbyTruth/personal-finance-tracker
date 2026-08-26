import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR']

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

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
  return new Intl.DateTimeFormat('en-GH', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`))
}

function emptyForm(month, currency) {
  return { categoryId: '', amount: '', budgetMonth: month, currency }
}

function statusFor(percent) {
  const value = Number(percent || 0)
  if (value > 100) return { label: 'Over budget', className: 'over' }
  if (value >= 80) return { label: 'Watch', className: 'warning' }
  return { label: 'On track', className: 'safe' }
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [currency, setCurrency] = useState('GHS')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm(currentMonth(), 'GHS'))

  async function loadBudgets(nextMonth = month, nextCurrency = currency) {
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest(`/api/finance/budgets?month=${encodeURIComponent(nextMonth)}&currency=${encodeURIComponent(nextCurrency)}`)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBudgets() }, [month, currency])

  const budgetedCategoryIds = useMemo(() => new Set((data?.budgets || []).map((item) => String(item.category_id))), [data])
  const availableCategories = useMemo(() => (data?.categories || []).filter((category) => {
    if (editing && String(category.id) === String(editing.category_id)) return true
    return !budgetedCategoryIds.has(String(category.id))
  }), [data, budgetedCategoryIds, editing])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm(month, currency))
    setError('')
    setShowForm(true)
  }

  function openEdit(budget) {
    setEditing(budget)
    setForm({
      categoryId: String(budget.category_id),
      amount: String(budget.amount),
      budgetMonth: String(budget.budget_month).slice(0, 7),
      currency: budget.currency,
    })
    setError('')
    setShowForm(true)
  }

  async function saveBudget(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const path = editing ? `/api/finance/budgets/${editing.id}` : '/api/finance/budgets'
      await apiRequest(path, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      setShowForm(false)
      setEditing(null)
      if (form.budgetMonth !== month || form.currency !== currency) {
        setMonth(form.budgetMonth)
        setCurrency(form.currency)
      } else {
        await loadBudgets()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteBudget(budget) {
    if (!window.confirm(`Delete the ${budget.category_name} budget for ${monthLabel(String(budget.budget_month).slice(0, 7))}? Your transactions will not be deleted.`)) return
    setError('')
    try {
      await apiRequest(`/api/finance/budgets/${budget.id}`, { method: 'DELETE' })
      await loadBudgets()
    } catch (err) {
      setError(err.message)
    }
  }

  const summary = data?.summary || {}
  const overallPercent = Math.max(0, Number(summary.percentUsed || 0))

  return (
    <section className="budgets-workspace">
      <div className="section-heading-row budget-heading">
        <div>
          <p className="eyebrow">PLAN · SPEND · ADJUST</p>
          <h1>Give every spending category a limit.</h1>
          <p className="muted">Budgets are plans. Actual spending always comes from your expense transactions, so there is no duplicate balance to maintain.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>+ Add budget</button>
      </div>

      <div className="budget-toolbar">
        <label>Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label>Currency
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className="budget-period-label"><span>Viewing</span><strong>{monthLabel(month)}</strong></div>
      </div>

      {error && <p className="error-message dashboard-error">{error}</p>}

      <section className="budget-summary-grid">
        <article><span>Monthly budget</span><strong>{money(summary.totalBudget || 0, currency)}</strong><small>{summary.budgetCount || 0} category budget{Number(summary.budgetCount) === 1 ? '' : 's'}</small></article>
        <article><span>Spent</span><strong>{money(summary.totalExpenses || 0, currency)}</strong><small>Expense transactions only</small></article>
        <article className={Number(summary.remaining || 0) < 0 ? 'budget-over-card' : ''}><span>Remaining</span><strong>{money(summary.remaining || 0, currency)}</strong><small>Budget minus all spending</small></article>
        <article><span>Budget used</span><strong>{Number(summary.percentUsed || 0).toFixed(1)}%</strong><small>{money(summary.unbudgetedSpent || 0, currency)} unbudgeted</small></article>
      </section>

      <section className="panel budget-overview-panel">
        <div className="panel-heading-row">
          <div><p className="eyebrow">MONTHLY CONTROL</p><h2>{monthLabel(month)}</h2></div>
          <span className={overallPercent > 100 ? 'budget-status over' : overallPercent >= 80 ? 'budget-status warning' : 'budget-status safe'}>
            {overallPercent > 100 ? 'Over budget' : overallPercent >= 80 ? 'Watch spending' : 'On track'}
          </span>
        </div>
        <div className="overall-budget-track"><span style={{ width: `${Math.min(overallPercent, 100)}%` }} /></div>
        <div className="overall-budget-copy"><span>0%</span><strong>{overallPercent.toFixed(1)}% used</strong><span>100%</span></div>
      </section>

      <div className="budget-content-grid">
        <section className="panel">
          <div className="panel-heading-row">
            <div><p className="eyebrow">CATEGORY BUDGETS</p><h2>Planned vs actual</h2></div>
            <span className="muted">{data?.budgets?.length || 0} active</span>
          </div>

          {loading ? (
            <div className="empty-inline">Loading budgets…</div>
          ) : data?.budgets?.length ? (
            <div className="budget-list">
              {data.budgets.map((budget) => {
                const percent = Math.max(0, Number(budget.percent_used || 0))
                const status = statusFor(percent)
                return (
                  <article className="budget-row" key={budget.id}>
                    <div className="budget-row-main">
                      <div className="budget-row-title">
                        <strong>{budget.category_name}</strong>
                        <span className={`budget-status ${status.className}`}>{status.label}</span>
                      </div>
                      <div className="category-budget-track"><span className={status.className} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                      <div className="budget-row-numbers">
                        <span>Spent {money(budget.spent, currency)}</span>
                        <span>of {money(budget.amount, currency)}</span>
                      </div>
                    </div>
                    <div className="budget-row-balance">
                      <span>{Number(budget.remaining) >= 0 ? 'Remaining' : 'Over by'}</span>
                      <strong className={Number(budget.remaining) < 0 ? 'amount-expense' : ''}>{money(Math.abs(Number(budget.remaining)), currency)}</strong>
                      <small>{percent.toFixed(1)}% used</small>
                    </div>
                    <div className="budget-row-actions">
                      <button className="text-button" onClick={() => openEdit(budget)}>Edit</button>
                      <button className="text-button danger-text" onClick={() => deleteBudget(budget)}>Delete</button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <div className="empty-icon">%</div>
              <h2>No budgets for {monthLabel(month)}</h2>
              <p>Create a spending limit for Food, Transport, Utilities or any other expense category.</p>
              <button className="primary-button" onClick={openCreate}>+ Add first budget</button>
            </div>
          )}
        </section>

        <aside className="panel">
          <p className="eyebrow">UNBUDGETED SPENDING</p>
          <h2>Expenses without a plan</h2>
          <p className="muted">These expenses are included in your total budget usage even though their categories do not yet have a budget.</p>
          <div className="unbudgeted-list">
            {data?.unbudgeted?.length ? data.unbudgeted.map((item) => (
              <div className="unbudgeted-row" key={item.category_id}>
                <span>{item.category_name}</span>
                <strong>{money(item.spent, currency)}</strong>
              </div>
            )) : <div className="empty-inline">No unbudgeted spending for this month.</div>}
          </div>
          {Number(summary.unbudgetedSpent || 0) > 0 && (
            <button className="secondary-button full-button" onClick={openCreate}>Budget an expense category</button>
          )}
        </aside>
      </div>

      <section className="architecture-panel">
        <p className="eyebrow">BUDGET RULE</p>
        <div className="formula-grid budget-formula">
          <div><strong>Budget</strong><span>Your planned limit for a category and month</span></div>
          <span className="formula-sign">−</span>
          <div><strong>Expense ledger</strong><span>Actual expense transactions in the same currency</span></div>
          <span className="formula-sign">=</span>
          <div><strong>Remaining</strong><span>What is left before you exceed the plan</span></div>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="budget-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{editing ? 'EDIT BUDGET' : 'NEW MONTHLY BUDGET'}</p><h2 id="budget-form-title">{editing ? editing.category_name : 'Set a spending limit'}</h2></div>
              <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={saveBudget}>
              <label>Expense category
                <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                  <option value="">Choose category</option>
                  {availableCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                </select>
              </label>

              <div className="form-grid-two">
                <label>Month
                  <input type="month" required disabled value={form.budgetMonth} />
                </label>
                <label>Currency
                  <select value={form.currency} disabled>
                    {CURRENCIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <label>Budget amount
                <input type="number" min="0.01" step="0.01" required placeholder="e.g. 1000.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                <small className="field-help">This is a spending limit, not money removed from any account. Change the month or currency from the Budgets toolbar before creating a budget.</small>
              </label>

              <p className="form-note">Only Expense transactions in this category, month and currency count against the budget. Transfers never count as spending.</p>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving || !availableCategories.length}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
