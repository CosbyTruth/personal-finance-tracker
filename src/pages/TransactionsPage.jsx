import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

const TYPES = ['Income', 'Expense', 'Transfer']

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function emptyTransaction(type = 'Expense') {
  return {
    transactionType: type,
    accountId: '',
    categoryId: '',
    transferAccountId: '',
    amount: '',
    description: '',
    notes: '',
    transactionDate: todayIso(),
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

function fullDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

export default function TransactionsPage({ intent }) {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [monthly, setMonthly] = useState([])
  const [filters, setFilters] = useState({ type: '', accountId: '', categoryId: '', from: '', to: '', search: '' })
  const [form, setForm] = useState(emptyTransaction())
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', categoryType: 'Expense' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeAccounts = useMemo(() => accounts.filter((account) => !account.is_archived), [accounts])
  const selectedAccount = useMemo(() => activeAccounts.find((account) => String(account.id) === String(form.accountId)), [activeAccounts, form.accountId])
  const matchingCategories = useMemo(() => categories.filter((category) => category.category_type === form.transactionType), [categories, form.transactionType])
  const transferDestinations = useMemo(() => activeAccounts.filter((account) => (
    String(account.id) !== String(form.accountId)
    && (!selectedAccount || account.currency === selectedAccount.currency)
  )), [activeAccounts, form.accountId, selectedAccount])

  async function loadTransactions(nextFilters = filters) {
    setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(nextFilters).forEach(([key, value]) => { if (value) params.set(key, value) })
      const data = await apiRequest(`/api/finance/transactions${params.toString() ? `?${params}` : ''}`)
      setTransactions(data.transactions || [])
      setAccounts(data.accounts || [])
      setCategories(data.categories || [])
      setMonthly(data.monthly || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTransactions() }, [])

  useEffect(() => {
    if (intent?.type && TYPES.includes(intent.type)) openCreate(intent.type)
  }, [intent?.key])

  function openCreate(type = 'Expense') {
    setEditing(null)
    setForm(emptyTransaction(type))
    setError('')
    setShowForm(true)
  }

  function openEdit(transaction) {
    setEditing(transaction)
    setForm({
      transactionType: transaction.transaction_type,
      accountId: String(transaction.account_id),
      categoryId: transaction.category_id ? String(transaction.category_id) : '',
      transferAccountId: transaction.transfer_account_id ? String(transaction.transfer_account_id) : '',
      amount: transaction.amount,
      description: transaction.description || '',
      notes: transaction.notes || '',
      transactionDate: String(transaction.transaction_date).slice(0, 10),
    })
    setError('')
    setShowForm(true)
  }

  function setType(type) {
    setForm((current) => ({ ...current, transactionType: type, categoryId: '', transferAccountId: '' }))
  }

  async function submitTransaction(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const path = editing ? `/api/finance/transactions/${editing.id}` : '/api/finance/transactions'
      await apiRequest(path, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          categoryId: form.transactionType === 'Transfer' ? null : form.categoryId,
          transferAccountId: form.transactionType === 'Transfer' ? form.transferAccountId : null,
        }),
      })
      setShowForm(false)
      setEditing(null)
      setForm(emptyTransaction())
      await loadTransactions()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransaction(transaction) {
    const label = transaction.description || transaction.category_name || 'this transaction'
    if (!window.confirm(`Remove “${label}” from active records? Kora will recalculate the balance and preserve an audit reversal.`)) return
    setError('')
    try {
      await apiRequest(`/api/finance/transactions/${transaction.id}`, { method: 'DELETE' })
      await loadTransactions()
    } catch (err) {
      setError(err.message)
    }
  }

  async function applyFilters(event) {
    event?.preventDefault()
    setLoading(true)
    await loadTransactions(filters)
  }

  async function clearFilters() {
    const cleared = { type: '', accountId: '', categoryId: '', from: '', to: '', search: '' }
    setFilters(cleared)
    setLoading(true)
    await loadTransactions(cleared)
  }

  async function submitCategory(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const data = await apiRequest('/api/finance/categories', { method: 'POST', body: JSON.stringify(categoryForm) })
      setCategories((current) => [...current, data.category])
      setCategoryForm({ name: '', categoryType: 'Expense' })
      setShowCategoryForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const ghsMonth = monthly.find((item) => item.currency === 'GHS')
  const legacyEntries = transactions.filter((item) => item.ledger_status !== 'Balanced').length

  return (
    <section className="transactions-workspace">
      <div className="section-heading-row transaction-heading">
        <div>
          <p className="eyebrow">MONEY ACTIVITY</p>
          <h1>Transactions & cash flow</h1>
          <p className="muted">Record income, expenses and transfers. Account balances are calculated from the ledger automatically.</p>
        </div>
        <div className="transaction-create-actions">
          <button className="secondary-button" onClick={() => openCreate('Income')}>+ Income</button>
          <button className="primary-button" onClick={() => openCreate('Expense')}>+ Expense</button>
          <button className="secondary-button" onClick={() => openCreate('Transfer')}>↔ Transfer</button>
        </div>
      </div>

      <div className="transaction-stat-strip">
        <div><span>GHS income this month</span><strong className="amount-income">{money(ghsMonth?.income || 0, 'GHS')}</strong></div>
        <div><span>GHS expenses this month</span><strong className="amount-expense">{money(ghsMonth?.expenses || 0, 'GHS')}</strong></div>
        <div><span>GHS net cash flow</span><strong>{money(ghsMonth?.net_cash_flow || 0, 'GHS')}</strong></div>
        <div><span>Visible transactions</span><strong>{transactions.length}</strong></div>
        <div><span>Ledger integrity</span><strong className={legacyEntries ? '' : 'amount-income'}>{legacyEntries ? `${legacyEntries} pending` : 'Balanced'}</strong></div>
      </div>

      <form className="transaction-filters" onSubmit={applyFilters}>
        <label>Type
          <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">All types</option>
            {TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label>Account
          <select value={filters.accountId} onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}>
            <option value="">All accounts</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.is_archived ? ' (archived)' : ''}</option>)}
          </select>
        </label>
        <label>Category
          <select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <label className="filter-search">Search<input placeholder="Description or notes" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <div className="filter-actions"><button className="primary-button" type="submit">Apply</button><button className="text-button" type="button" onClick={clearFilters}>Clear</button></div>
      </form>

      <div className="transaction-toolbar">
        <span className="muted">Showing up to 500 matching entries</span>
        <button className="text-button" onClick={() => setShowCategoryForm(true)}>+ Custom category</button>
      </div>

      {error && <p className="error-message dashboard-error">{error}</p>}

      {loading ? (
        <div className="empty-state"><strong>Loading transactions…</strong></div>
      ) : transactions.length ? (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <article className="transaction-row" key={transaction.id}>
              <div className={`transaction-badge ${transaction.transaction_type.toLowerCase()}`}>
                {transaction.transaction_type === 'Income' ? '+' : transaction.transaction_type === 'Expense' ? '−' : '↔'}
              </div>
              <div className="transaction-main">
                <div className="transaction-title-line">
                  <strong>{transaction.description || transaction.category_name || 'Transfer'}</strong>
                  <span className={`type-chip ${transaction.transaction_type.toLowerCase()}`}>{transaction.transaction_type}</span>
                  <span className={`ledger-proof ${transaction.ledger_status === 'Balanced' ? 'balanced' : 'legacy'}`}><i />{transaction.ledger_status === 'Balanced' ? 'Balanced entry' : 'Needs migration'}</span>
                </div>
                <p>
                  {transaction.transaction_type === 'Transfer'
                    ? `${transaction.account_name} → ${transaction.transfer_account_name}`
                    : `${transaction.account_name} · ${transaction.category_name}`}
                </p>
                {transaction.notes && <small>{transaction.notes}</small>}
              </div>
              <div className="transaction-value">
                <strong className={transaction.transaction_type === 'Income' ? 'amount-income' : transaction.transaction_type === 'Expense' ? 'amount-expense' : ''}>
                  {transaction.transaction_type === 'Income' ? '+' : transaction.transaction_type === 'Expense' ? '−' : ''}{money(transaction.amount, transaction.currency)}
                </strong>
                <span>{fullDate(transaction.transaction_date)}</span>
              </div>
              <div className="transaction-actions">
                <button className="text-button subtle" onClick={() => openEdit(transaction)}>Edit</button>
                <button className="text-button danger-text" onClick={() => deleteTransaction(transaction)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">₵</div>
          <h2>No transactions found</h2>
          <p>Add your first income or expense, or clear the filters if you expected to see existing entries.</p>
          <button className="primary-button" onClick={() => openCreate('Expense')}>+ Add transaction</button>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}>
          <div className="modal-card transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{editing ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}</p><h2 id="transaction-form-title">{editing ? 'Update ledger entry' : 'Record money movement'}</h2></div>
              <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={submitTransaction}>
              <div className="transaction-type-selector">
                {TYPES.map((type) => <button type="button" key={type} className={form.transactionType === type ? `active ${type.toLowerCase()}` : ''} onClick={() => setType(type)}>{type}</button>)}
              </div>

              {!activeAccounts.length && <p className="error-message">Create at least one active account before recording transactions.</p>}

              <div className="form-grid-two">
                <label>{form.transactionType === 'Transfer' ? 'From account' : 'Account'}
                  <select required value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value, transferAccountId: '' })}>
                    <option value="">Choose account</option>
                    {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
                  </select>
                </label>
                <label>Amount
                  <input type="number" min="0.01" step="0.01" required placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                </label>
              </div>

              {form.transactionType === 'Transfer' ? (
                <label>To account
                  <select required value={form.transferAccountId} disabled={!form.accountId} onChange={(event) => setForm({ ...form, transferAccountId: event.target.value })}>
                    <option value="">Choose destination</option>
                    {transferDestinations.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
                  </select>
                  <small className="field-help">Only accounts using the same currency as the source are shown.</small>
                </label>
              ) : (
                <label>Category
                  <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">Choose {form.transactionType.toLowerCase()} category</option>
                    {matchingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              )}

              <div className="form-grid-two">
                <label>Date<input type="date" required value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label>
                <label>Description<input maxLength="180" placeholder={form.transactionType === 'Transfer' ? 'e.g. Move money to savings' : 'e.g. Fuel'} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              </div>

              <label>Notes
                <textarea maxLength="2000" placeholder="Optional extra details" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>

              <div className="form-note">
                {form.transactionType === 'Income' && 'Income increases the selected account balance and counts toward cash inflow.'}
                {form.transactionType === 'Expense' && 'Expenses reduce the selected account balance and count toward spending.'}
                {form.transactionType === 'Transfer' && 'Transfers reduce one account and increase another by the same amount. They do not count as income or expense.'}
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving || !activeAccounts.length}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Record transaction'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCategoryForm(false) }}>
          <div className="modal-card category-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div><p className="eyebrow">CUSTOM CATEGORY</p><h2>Add a category</h2></div>
              <button className="icon-button" onClick={() => setShowCategoryForm(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submitCategory}>
              <label>Category name<input maxLength="80" required placeholder="e.g. Subscriptions" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
              <label>Type<select value={categoryForm.categoryType} onChange={(event) => setCategoryForm({ ...categoryForm, categoryType: event.target.value })}><option>Expense</option><option>Income</option></select></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCategoryForm(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Create category'}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
