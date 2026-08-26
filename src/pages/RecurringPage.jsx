import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

const FREQUENCIES = ['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly']

function money(amount, currency) {
  const value = Number(amount || 0)
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function dateLabel(value) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

function emptyForm() {
  return {
    name: '', transactionType: 'Expense', accountId: '', categoryId: '', amount: '',
    frequency: 'Monthly', nextDueDate: todayIso(), endDate: '', notes: '',
  }
}

export default function RecurringPage({ onOpenTransactions }) {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState('active')
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [posting, setPosting] = useState(null)
  const [postForm, setPostForm] = useState({ amount: '', transactionDate: todayIso() })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const data = await apiRequest('/api/finance/recurring?includeInactive=true')
      setItems(data.items || [])
      setSummary(data.summary || null)
      setAccounts(data.accounts || [])
      setCategories(data.categories || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === 'active') return item.is_active
    if (filter === 'paused') return !item.is_active
    return true
  }), [items, filter])

  const activeAccounts = useMemo(() => accounts.filter((account) => !account.is_archived), [accounts])
  const formCategories = useMemo(() => categories.filter((category) => category.category_type === form.transactionType), [categories, form.transactionType])

  function openCreate() {
    const next = emptyForm()
    next.accountId = activeAccounts[0]?.id || ''
    next.categoryId = categories.find((category) => category.category_type === 'Expense')?.id || ''
    setEditing(null)
    setForm(next)
    setError('')
    setShowForm(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      name: item.name,
      transactionType: item.transaction_type,
      accountId: String(item.account_id),
      categoryId: String(item.category_id),
      amount: item.amount,
      frequency: item.frequency,
      nextDueDate: String(item.next_due_date).slice(0, 10),
      endDate: item.end_date ? String(item.end_date).slice(0, 10) : '',
      notes: item.notes || '',
    })
    setError('')
    setShowForm(true)
  }

  function changeType(transactionType) {
    const category = categories.find((item) => item.category_type === transactionType)
    setForm((current) => ({ ...current, transactionType, categoryId: category?.id || '' }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiRequest(editing ? `/api/finance/recurring/${editing.id}` : '/api/finance/recurring', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm())
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(item) {
    setError('')
    try {
      await apiRequest(`/api/finance/recurring/${item.id}/${item.is_active ? 'pause' : 'resume'}`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.name}”? Only schedules with no processed history can be deleted.`)) return
    setError('')
    try {
      await apiRequest(`/api/finance/recurring/${item.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function openPost(item) {
    setPosting(item)
    setPostForm({ amount: item.amount, transactionDate: todayIso() })
    setError('')
  }

  async function postOccurrence(event) {
    event.preventDefault()
    if (!posting) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/finance/recurring/${posting.id}/post`, {
        method: 'POST',
        body: JSON.stringify(postForm),
      })
      setPosting(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function skip(item) {
    if (!window.confirm(`Skip the ${dateLabel(item.next_due_date)} occurrence of “${item.name}”? No transaction will be created.`)) return
    setError('')
    try {
      await apiRequest(`/api/finance/recurring/${item.id}/skip`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="recurring-workspace">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">MONEY RHYTHM</p>
          <h1>Recurring bills & income</h1>
          <p className="muted">Plan repeated cash flow. A schedule never changes a balance until you explicitly post the occurrence into Transactions.</p>
        </div>
        <button className="primary-button" onClick={openCreate} disabled={!activeAccounts.length}>+ Add recurring</button>
      </div>

      <div className="recurring-summary-grid">
        <article><span>Due today</span><strong>{summary?.dueToday || 0}</strong><small>Ready to process</small></article>
        <article><span>Overdue</span><strong className={Number(summary?.overdue || 0) ? 'amount-expense' : ''}>{summary?.overdue || 0}</strong><small>Needs attention</small></article>
        <article><span>Next 30 days</span><strong>{summary?.dueNext30Days || 0}</strong><small>Upcoming schedules</small></article>
        <article><span>Active</span><strong>{summary?.active || 0}</strong><small>{summary?.paused || 0} paused</small></article>
      </div>

      {summary?.byCurrency?.length ? (
        <div className="recurring-cashflow-strip">
          {summary.byCurrency.map((row) => (
            <div key={row.currency}>
              <span>{row.currency} · next 30 days</span>
              <strong>{money(row.net30, row.currency)}</strong>
              <small>Expected income {money(row.income30, row.currency)} · bills {money(row.expenses30, row.currency)}</small>
            </div>
          ))}
        </div>
      ) : null}

      {!activeAccounts.length && !loading && (
        <div className="form-note">Create at least one active account before adding recurring bills or income.</div>
      )}
      {error && <p className="error-message dashboard-error">{error}</p>}

      <div className="recurring-toolbar">
        <div className="segmented-control">
          <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active</button>
          <button className={filter === 'paused' ? 'active' : ''} onClick={() => setFilter('paused')}>Paused</button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        </div>
        <span className="muted">{visibleItems.length} recurring item{visibleItems.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="empty-state"><strong>Loading recurring cash flow…</strong></div>
      ) : visibleItems.length ? (
        <div className="recurring-grid">
          {visibleItems.map((item) => (
            <article className={`recurring-card ${!item.is_active ? 'paused' : ''}`} key={item.id}>
              <div className="recurring-card-heading">
                <div>
                  <span className={`recurring-type ${item.transaction_type.toLowerCase()}`}>{item.transaction_type === 'Income' ? '+ Income' : '− Bill / Expense'}</span>
                  <h2>{item.name}</h2>
                </div>
                <span className={`due-chip ${String(item.due_status).toLowerCase().replaceAll(' ', '-')}`}>{item.due_status}</span>
              </div>

              <div className="recurring-money-line">
                <strong className={item.transaction_type === 'Income' ? 'amount-income' : 'amount-expense'}>{money(item.amount, item.currency)}</strong>
                <span>{item.frequency}</span>
              </div>

              <div className="recurring-meta-grid">
                <div><span>Next due</span><strong>{dateLabel(item.next_due_date)}</strong></div>
                <div><span>Account</span><strong>{item.account_name}</strong></div>
                <div><span>Category</span><strong>{item.category_name}</strong></div>
                <div><span>History</span><strong>{item.posted_count} posted · {item.skipped_count} skipped</strong></div>
              </div>

              {item.end_date && <p className="recurring-note">Ends {dateLabel(item.end_date)}</p>}
              {item.notes && <p className="recurring-note">{item.notes}</p>}

              <div className="recurring-actions">
                {item.is_active && <button className="primary-button compact" onClick={() => openPost(item)}>Post now</button>}
                {item.is_active && <button className="secondary-button compact" onClick={() => skip(item)}>Skip</button>}
                <button className="text-button" onClick={() => openEdit(item)}>Edit</button>
                <button className="text-button" onClick={() => toggle(item)}>{item.is_active ? 'Pause' : 'Resume'}</button>
                {Number(item.occurrence_count || 0) === 0 && <button className="text-button danger-text" onClick={() => remove(item)}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">↻</div>
          <h2>{filter === 'active' ? 'No active recurring cash flow' : `No ${filter} recurring items`}</h2>
          <p>Add salary, rent, utilities, internet, subscriptions, insurance or any other repeated income/expense.</p>
          {filter === 'active' && activeAccounts.length > 0 && <button className="primary-button" onClick={openCreate}>+ Add recurring</button>}
        </div>
      )}

      <section className="architecture-panel recurring-rule-panel">
        <p className="eyebrow">ACCOUNTING RULE</p>
        <div className="formula-grid recurring-formula">
          <div><strong>Schedule</strong><span>Expected amount + due date</span></div>
          <span className="formula-sign">→</span>
          <div><strong>Post</strong><span>Creates one real transaction</span></div>
          <span className="formula-sign">→</span>
          <div><strong>Ledger</strong><span>Balance and budget update once</span></div>
          <span className="formula-sign">→</span>
          <div><strong>Advance</strong><span>Next due date is calculated</span></div>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}>
          <div className="modal-card recurring-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div><p className="eyebrow">{editing ? 'EDIT RECURRING ITEM' : 'NEW RECURRING ITEM'}</p><h2>{editing ? editing.name : 'Plan repeated cash flow'}</h2></div>
              <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submit}>
              <div className="segmented-control recurring-type-control">
                <button type="button" className={form.transactionType === 'Expense' ? 'active' : ''} onClick={() => changeType('Expense')}>Expense / Bill</button>
                <button type="button" className={form.transactionType === 'Income' ? 'active' : ''} onClick={() => changeType('Income')}>Income</button>
              </div>
              <label>Name
                <input required maxLength="120" value={form.name} placeholder={form.transactionType === 'Income' ? 'e.g. Monthly Salary' : 'e.g. Internet Bill'} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <div className="form-grid-two">
                <label>Account
                  <select required value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                    <option value="">Choose account</option>
                    {accounts.map((account) => <option value={account.id} key={account.id} disabled={account.is_archived}>{account.name} · {account.currency}{account.is_archived ? ' · archived' : ''}</option>)}
                  </select>
                </label>
                <label>Category
                  <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">Choose category</option>
                    {formCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid-two">
                <label>Expected amount
                  <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                </label>
                <label>Frequency
                  <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
                    {FREQUENCIES.map((frequency) => <option key={frequency}>{frequency}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid-two">
                <label>Next due date
                  <input type="date" required value={form.nextDueDate} onChange={(event) => setForm({ ...form, nextDueDate: event.target.value })} />
                </label>
                <label>End date <span className="optional-label">optional</span>
                  <input type="date" min={form.nextDueDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
                </label>
              </div>
              <label>Notes <span className="optional-label">optional</span>
                <textarea rows="3" maxLength="2000" value={form.notes} placeholder="Reference, provider, expected variation…" onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
              <p className="form-note">This schedule does not touch your balance. Use “Post now” when the income or expense actually happens.</p>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {posting && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPosting(null) }}>
          <div className="modal-card post-recurring-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div><p className="eyebrow">POST TO LEDGER</p><h2>{posting.name}</h2></div>
              <button className="icon-button" onClick={() => setPosting(null)} aria-label="Close">×</button>
            </div>
            <div className="post-recurring-preview">
              <div><span>Scheduled</span><strong>{dateLabel(posting.next_due_date)}</strong></div>
              <div><span>Expected</span><strong>{money(posting.amount, posting.currency)}</strong></div>
              <div><span>Account</span><strong>{posting.account_name}</strong></div>
            </div>
            <form onSubmit={postOccurrence}>
              <div className="form-grid-two">
                <label>Actual amount
                  <input type="number" min="0.01" step="0.01" required value={postForm.amount} onChange={(event) => setPostForm({ ...postForm, amount: event.target.value })} />
                  <small className="field-help">You can change this for variable bills.</small>
                </label>
                <label>Transaction date
                  <input type="date" required value={postForm.transactionDate} onChange={(event) => setPostForm({ ...postForm, transactionDate: event.target.value })} />
                </label>
              </div>
              <p className="form-note">Posting creates one {posting.transaction_type.toLowerCase()} transaction, updates balances/budgets, records this occurrence, and advances the next due date.</p>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setPosting(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Posting…' : `Post ${posting.transaction_type.toLowerCase()}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
