import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

const ACCOUNT_TYPES = ['Cash', 'Bank', 'Mobile Money', 'Savings', 'Investment', 'Credit', 'Other']
const COMMON_CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR']

function money(amount, currency) {
  const value = Number(amount || 0)
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function emptyForm() {
  return { name: '', accountType: 'Mobile Money', currency: 'GHS', openingBalance: '0.00' }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [balances, setBalances] = useState([])
  const [filter, setFilter] = useState('active')
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadAccounts() {
    setError('')
    try {
      const data = await apiRequest('/api/finance/accounts')
      setAccounts(data.accounts || [])
      setBalances(data.balances || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  const visibleAccounts = useMemo(() => accounts.filter((account) => {
    if (filter === 'active') return !account.is_archived
    if (filter === 'archived') return account.is_archived
    return true
  }), [accounts, filter])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setShowForm(true)
  }

  function openEdit(account) {
    setEditing(account)
    setForm({
      name: account.name,
      accountType: account.account_type,
      currency: account.currency,
      openingBalance: account.opening_balance,
    })
    setError('')
    setShowForm(true)
  }

  async function submitAccount(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const path = editing ? `/api/finance/accounts/${editing.id}` : '/api/finance/accounts'
      await apiRequest(path, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm())
      await loadAccounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function archive(account) {
    if (!window.confirm(`Archive “${account.name}”? Its history will be kept.`)) return
    setError('')
    try {
      await apiRequest(`/api/finance/accounts/${account.id}/archive`, { method: 'POST' })
      await loadAccounts()
    } catch (err) {
      setError(err.message)
    }
  }

  async function restore(account) {
    setError('')
    try {
      await apiRequest(`/api/finance/accounts/${account.id}/restore`, { method: 'POST' })
      await loadAccounts()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="accounts-workspace">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">MONEY PLACES</p>
          <h1>Accounts & balances</h1>
          <p className="muted">Add every place where you keep money. Archived accounts remain in your records instead of being deleted.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>+ Add account</button>
      </div>

      <div className="balance-summary-strip">
        {balances.length
          ? balances.map((item) => <div key={item.currency}><span>{item.currency}</span><strong>{money(item.balance, item.currency)}</strong></div>)
          : <div><span>TOTALS</span><strong>No accounts yet</strong></div>}
      </div>

      <div className="account-toolbar">
        <div className="segmented-control">
          <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active</button>
          <button className={filter === 'archived' ? 'active' : ''} onClick={() => setFilter('archived')}>Archived</button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        </div>
        <span className="muted">{visibleAccounts.length} account{visibleAccounts.length === 1 ? '' : 's'}</span>
      </div>

      {error && <p className="error-message dashboard-error">{error}</p>}

      {loading ? (
        <div className="empty-state"><strong>Loading accounts…</strong></div>
      ) : visibleAccounts.length ? (
        <div className="accounts-grid">
          {visibleAccounts.map((account) => (
            <article className={account.is_archived ? 'account-card archived' : 'account-card'} key={account.id}>
              <div className="account-card-top">
                <div className="account-type-icon">{account.account_type === 'Mobile Money' ? 'MM' : account.account_type.slice(0, 2).toUpperCase()}</div>
                <div className="account-card-actions">
                  <button className="text-button subtle" onClick={() => openEdit(account)}>Edit</button>
                  {account.is_archived
                    ? <button className="text-button" onClick={() => restore(account)}>Restore</button>
                    : <button className="text-button danger-text" onClick={() => archive(account)}>Archive</button>}
                </div>
              </div>
              <p className="account-kind">{account.account_type}{account.is_archived ? ' · Archived' : ''}</p>
              <h2>{account.name}</h2>
              <strong className="account-balance">{money(account.current_balance, account.currency)}</strong>
              <div className="account-meta">
                <span>Opening: {money(account.opening_balance, account.currency)}</span>
                <span>{account.transaction_count} transaction{account.transaction_count === 1 ? '' : 's'}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">PF</div>
          <h2>{filter === 'active' ? 'Create your first account' : `No ${filter} accounts`}</h2>
          <p>{filter === 'active' ? 'Start with the account you use most often, such as MTN MoMo, your bank account or cash wallet.' : 'Nothing to show in this view.'}</p>
          {filter === 'active' && <button className="primary-button" onClick={openCreate}>+ Add account</button>}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{editing ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</p><h2 id="account-form-title">{editing ? editing.name : 'Add an account'}</h2></div>
              <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={submitAccount}>
              <label>Account name
                <input value={form.name} maxLength="80" required placeholder="e.g. MTN MoMo" onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>

              <div className="form-grid-two">
                <label>Account type
                  <select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })}>
                    {ACCOUNT_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>Currency
                  <select value={form.currency} disabled={Boolean(editing?.transaction_count)} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
                    {COMMON_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                  </select>
                </label>
              </div>

              <label>Opening balance
                <input type="number" step="0.01" value={form.openingBalance} disabled={Boolean(editing?.transaction_count)} required onChange={(event) => setForm({ ...form, openingBalance: event.target.value })} />
                <small className="field-help">Enter the amount already in this account before you start recording transactions. Use a negative value for money owed, if applicable.</small>
              </label>

              {editing?.transaction_count > 0 && <p className="form-note">Currency and opening balance are locked because this account already has transaction history.</p>}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
