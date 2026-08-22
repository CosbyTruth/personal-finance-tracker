import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR']
const GOAL_TYPES = ['Emergency Fund', 'Purchase', 'Travel', 'Business', 'Investment', 'Education', 'Other']
const PRIORITIES = ['Low', 'Medium', 'High']

function todayIso() {
  return new Date().toISOString().slice(0, 10)
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
  if (!value) return 'No target date'
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
}

function emptyGoalForm() {
  return {
    name: '',
    goalType: 'Emergency Fund',
    currency: 'GHS',
    targetAmount: '',
    startingAmount: '0',
    targetDate: '',
    priority: 'Medium',
    notes: '',
  }
}

function emptyEntryForm() {
  return { entryType: 'Contribution', amount: '', contributionDate: todayIso(), notes: '' }
}

function targetTiming(goal) {
  if (!goal.target_date || goal.status === 'Completed') return ''
  const target = new Date(`${String(goal.target_date).slice(0, 10)}T00:00:00`)
  const today = new Date(`${todayIso()}T00:00:00`)
  const days = Math.ceil((target - today) / 86400000)
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today'
  return `${days} day${days === 1 ? '' : 's'} remaining`
}

export default function GoalsPage() {
  const [data, setData] = useState({ goals: [], summary: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('active')
  const [currency, setCurrency] = useState('All')
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [goalForm, setGoalForm] = useState(emptyGoalForm())
  const [savingGoal, setSavingGoal] = useState(false)
  const [progressGoal, setProgressGoal] = useState(null)
  const [entryForm, setEntryForm] = useState(emptyEntryForm())
  const [editingEntry, setEditingEntry] = useState(null)
  const [savingEntry, setSavingEntry] = useState(false)

  async function loadGoals() {
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest('/api/finance/goals?includeArchived=true')
      setData(result)
      if (progressGoal) {
        const refreshed = result.goals.find((goal) => String(goal.id) === String(progressGoal.id))
        if (refreshed) setProgressGoal(refreshed)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGoals() }, [])

  const filteredGoals = useMemo(() => (data.goals || []).filter((goal) => {
    if (view === 'active' && goal.is_archived) return false
    if (view === 'archived' && !goal.is_archived) return false
    if (currency !== 'All' && goal.currency !== currency) return false
    return true
  }), [data.goals, view, currency])

  function openCreate() {
    setEditingGoal(null)
    setGoalForm(emptyGoalForm())
    setError('')
    setShowGoalForm(true)
  }

  function openEdit(goal) {
    setEditingGoal(goal)
    setGoalForm({
      name: goal.name,
      goalType: goal.goal_type,
      currency: goal.currency,
      targetAmount: String(goal.target_amount),
      startingAmount: String(goal.starting_amount),
      targetDate: goal.target_date ? String(goal.target_date).slice(0, 10) : '',
      priority: goal.priority,
      notes: goal.notes || '',
    })
    setError('')
    setShowGoalForm(true)
  }

  async function saveGoal(event) {
    event.preventDefault()
    setSavingGoal(true)
    setError('')
    try {
      const path = editingGoal ? `/api/finance/goals/${editingGoal.id}` : '/api/finance/goals'
      await apiRequest(path, {
        method: editingGoal ? 'PUT' : 'POST',
        body: JSON.stringify(goalForm),
      })
      setShowGoalForm(false)
      setEditingGoal(null)
      await loadGoals()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingGoal(false)
    }
  }

  async function toggleArchive(goal) {
    const action = goal.is_archived ? 'restore' : 'archive'
    const prompt = goal.is_archived
      ? `Restore “${goal.name}”?`
      : `Archive “${goal.name}”? Its history will be kept.`
    if (!window.confirm(prompt)) return
    setError('')
    try {
      await apiRequest(`/api/finance/goals/${goal.id}/${action}`, { method: 'POST' })
      await loadGoals()
    } catch (err) {
      setError(err.message)
    }
  }

  function openProgress(goal) {
    setProgressGoal(goal)
    setEditingEntry(null)
    setEntryForm(emptyEntryForm())
    setError('')
  }

  function editEntry(entry) {
    setEditingEntry(entry)
    setEntryForm({
      entryType: entry.entry_type,
      amount: String(entry.amount),
      contributionDate: String(entry.contribution_date).slice(0, 10),
      notes: entry.notes || '',
    })
  }

  async function saveEntry(event) {
    event.preventDefault()
    if (!progressGoal) return
    setSavingEntry(true)
    setError('')
    try {
      const path = editingEntry
        ? `/api/finance/goals/${progressGoal.id}/entries/${editingEntry.id}`
        : `/api/finance/goals/${progressGoal.id}/entries`
      const result = await apiRequest(path, {
        method: editingEntry ? 'PUT' : 'POST',
        body: JSON.stringify(entryForm),
      })
      setProgressGoal(result.goal)
      setData((current) => ({
        ...current,
        summary: result.summary || current.summary,
        goals: current.goals.map((goal) => String(goal.id) === String(result.goal.id) ? result.goal : goal),
      }))
      setEditingEntry(null)
      setEntryForm(emptyEntryForm())
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEntry(false)
    }
  }

  async function deleteEntry(entry) {
    if (!progressGoal || !window.confirm('Delete this goal progress entry? This does not delete any finance transaction.')) return
    setError('')
    try {
      const result = await apiRequest(`/api/finance/goals/${progressGoal.id}/entries/${entry.id}`, { method: 'DELETE' })
      setProgressGoal(result.goal)
      setData((current) => ({
        ...current,
        summary: result.summary || current.summary,
        goals: current.goals.map((goal) => String(goal.id) === String(result.goal.id) ? result.goal : goal),
      }))
      if (editingEntry && String(editingEntry.id) === String(entry.id)) {
        setEditingEntry(null)
        setEntryForm(emptyEntryForm())
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const activeCount = (data.goals || []).filter((goal) => !goal.is_archived).length
  const completedCount = (data.goals || []).filter((goal) => !goal.is_archived && goal.status === 'Completed').length

  return (
    <section className="goals-workspace">
      <div className="section-heading-row goals-heading">
        <div>
          <p className="eyebrow">MILESTONE 5 · SAVINGS GOALS & TARGETS</p>
          <h1>Turn future plans into measurable targets.</h1>
          <p className="muted">Track how much you have earmarked for each goal without changing your account balances or cash-flow totals twice.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>+ New goal</button>
      </div>

      {error && <p className="error-message dashboard-error">{error}</p>}

      <section className="goal-summary-grid">
        <article><span>Active goals</span><strong>{activeCount}</strong><small>{completedCount} completed target{completedCount === 1 ? '' : 's'}</small></article>
        {(data.summary || []).length ? data.summary.slice(0, 3).map((row) => (
          <article key={row.currency}>
            <span>{row.currency} saved</span>
            <strong>{money(row.saved, row.currency)}</strong>
            <small>{row.percentComplete}% of {money(row.target, row.currency)}</small>
          </article>
        )) : <article><span>Goal progress</span><strong>0%</strong><small>Create your first target</small></article>}
      </section>

      <div className="goal-toolbar">
        <div className="segmented-control" aria-label="Goal status">
          <button className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>Active</button>
          <button className={view === 'archived' ? 'active' : ''} onClick={() => setView('archived')}>Archived</button>
        </div>
        <label>Currency
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option>All</option>
            {CURRENCIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="empty-inline">Loading savings goals…</div>
      ) : filteredGoals.length ? (
        <div className="goals-grid">
          {filteredGoals.map((goal) => {
            const percent = Math.max(0, Number(goal.percent_complete || 0))
            const completed = goal.status === 'Completed'
            const timing = targetTiming(goal)
            return (
              <article className={`goal-card ${completed ? 'goal-complete' : ''}`} key={goal.id}>
                <div className="goal-card-heading">
                  <div>
                    <span className="goal-type-chip">{goal.goal_type}</span>
                    <h2>{goal.name}</h2>
                  </div>
                  <span className={`priority-chip ${goal.priority.toLowerCase()}`}>{goal.priority}</span>
                </div>

                <div className="goal-money-line">
                  <strong>{money(goal.current_saved, goal.currency)}</strong>
                  <span>of {money(goal.target_amount, goal.currency)}</span>
                </div>
                <div className="goal-progress-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                <div className="goal-progress-copy">
                  <strong>{percent.toFixed(1)}%</strong>
                  <span>{completed ? 'Target reached' : `${money(goal.remaining, goal.currency)} remaining`}</span>
                </div>

                <div className="goal-meta-grid">
                  <div><span>Target date</span><strong>{dateLabel(goal.target_date)}</strong><small>{timing}</small></div>
                  <div><span>Progress entries</span><strong>{goal.entry_count}</strong><small>{money(goal.contributions, goal.currency)} contributed</small></div>
                </div>

                {goal.notes && <p className="goal-note">{goal.notes}</p>}

                <div className="goal-actions">
                  {!goal.is_archived && <button className="primary-button compact" onClick={() => openProgress(goal)}>{completed ? 'View progress' : '+ Update progress'}</button>}
                  {goal.is_archived && <button className="secondary-button compact" onClick={() => openProgress(goal)}>View history</button>}
                  <button className="text-button" onClick={() => openEdit(goal)}>Edit</button>
                  <button className="text-button" onClick={() => toggleArchive(goal)}>{goal.is_archived ? 'Restore' : 'Archive'}</button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <div className="empty-icon">◎</div>
          <h2>{view === 'active' ? 'No active savings goals' : 'No archived goals'}</h2>
          <p>{view === 'active' ? 'Create a target for an emergency fund, purchase, business capital, travel or another objective.' : 'Archived goals will remain here with their full progress history.'}</p>
          {view === 'active' && <button className="primary-button" onClick={openCreate}>+ Create first goal</button>}
        </div>
      )}

      <section className="architecture-panel goal-rule-panel">
        <p className="eyebrow">NO DOUBLE COUNTING</p>
        <div className="formula-grid goal-formula">
          <div><strong>Real money movement</strong><span>Record it once in Transactions: income, expense or transfer</span></div>
          <span className="formula-sign">+</span>
          <div><strong>Goal allocation</strong><span>Mark how much of your existing money is earmarked for a target</span></div>
          <span className="formula-sign">=</span>
          <div><strong>Clear progress</strong><span>Goal tracking without inventing extra income or changing balances twice</span></div>
        </div>
      </section>

      {showGoalForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGoalForm(false) }}>
          <div className="modal-card goal-modal" role="dialog" aria-modal="true" aria-labelledby="goal-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{editingGoal ? 'EDIT SAVINGS GOAL' : 'NEW SAVINGS GOAL'}</p><h2 id="goal-form-title">{editingGoal ? editingGoal.name : 'Create a financial target'}</h2></div>
              <button className="icon-button" onClick={() => setShowGoalForm(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={saveGoal}>
              <label>Goal name
                <input required maxLength="120" placeholder="e.g. Emergency Fund" value={goalForm.name} onChange={(event) => setGoalForm({ ...goalForm, name: event.target.value })} />
              </label>

              <div className="form-grid-two">
                <label>Goal type
                  <select value={goalForm.goalType} onChange={(event) => setGoalForm({ ...goalForm, goalType: event.target.value })}>
                    {GOAL_TYPES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>Priority
                  <select value={goalForm.priority} onChange={(event) => setGoalForm({ ...goalForm, priority: event.target.value })}>
                    {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="form-grid-two">
                <label>Currency
                  <select disabled={Boolean(editingGoal?.entry_count)} value={goalForm.currency} onChange={(event) => setGoalForm({ ...goalForm, currency: event.target.value })}>
                    {CURRENCIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>Target amount
                  <input type="number" min="0.01" step="0.01" required value={goalForm.targetAmount} onChange={(event) => setGoalForm({ ...goalForm, targetAmount: event.target.value })} />
                </label>
              </div>

              <div className="form-grid-two">
                <label>Already saved
                  <input type="number" min="0" step="0.01" disabled={Boolean(editingGoal?.entry_count)} value={goalForm.startingAmount} onChange={(event) => setGoalForm({ ...goalForm, startingAmount: event.target.value })} />
                  <small className="field-help">Starting snapshot only. It does not change an account balance.</small>
                </label>
                <label>Target date
                  <input type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm({ ...goalForm, targetDate: event.target.value })} />
                </label>
              </div>

              <label>Notes
                <textarea rows="3" maxLength="2000" placeholder="Why this goal matters, milestone notes, etc." value={goalForm.notes} onChange={(event) => setGoalForm({ ...goalForm, notes: event.target.value })} />
              </label>

              {editingGoal?.entry_count > 0 && <p className="form-note">Currency and starting amount are locked because this goal already has progress history. The target amount and date can still be updated.</p>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowGoalForm(false)}>Cancel</button>
                <button className="primary-button" disabled={savingGoal}>{savingGoal ? 'Saving…' : editingGoal ? 'Save changes' : 'Create goal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {progressGoal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProgressGoal(null) }}>
          <div className="modal-card progress-modal" role="dialog" aria-modal="true" aria-labelledby="progress-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">GOAL PROGRESS</p><h2 id="progress-form-title">{progressGoal.name}</h2></div>
              <button className="icon-button" onClick={() => setProgressGoal(null)} aria-label="Close">×</button>
            </div>

            <div className="progress-modal-summary">
              <div><span>Saved</span><strong>{money(progressGoal.current_saved, progressGoal.currency)}</strong></div>
              <div><span>Target</span><strong>{money(progressGoal.target_amount, progressGoal.currency)}</strong></div>
              <div><span>Complete</span><strong>{Number(progressGoal.percent_complete || 0).toFixed(1)}%</strong></div>
            </div>

            {!progressGoal.is_archived && (
              <form className="goal-entry-form" onSubmit={saveEntry}>
                <div className="form-grid-two">
                  <label>Entry type
                    <select value={entryForm.entryType} onChange={(event) => setEntryForm({ ...entryForm, entryType: event.target.value })}>
                      <option>Contribution</option>
                      <option>Withdrawal</option>
                    </select>
                  </label>
                  <label>Amount
                    <input type="number" min="0.01" step="0.01" required value={entryForm.amount} onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })} />
                  </label>
                </div>
                <div className="form-grid-two">
                  <label>Date
                    <input type="date" required value={entryForm.contributionDate} onChange={(event) => setEntryForm({ ...entryForm, contributionDate: event.target.value })} />
                  </label>
                  <label>Note
                    <input maxLength="300" placeholder="Optional" value={entryForm.notes} onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })} />
                  </label>
                </div>
                <p className="form-note">This updates goal allocation only. If money physically moved between accounts, record that separately as one Transfer transaction.</p>
                <div className="entry-form-actions">
                  {editingEntry && <button type="button" className="text-button" onClick={() => { setEditingEntry(null); setEntryForm(emptyEntryForm()) }}>Cancel edit</button>}
                  <button className="primary-button compact" disabled={savingEntry}>{savingEntry ? 'Saving…' : editingEntry ? 'Update entry' : 'Record progress'}</button>
                </div>
              </form>
            )}

            <div className="goal-history">
              <div className="panel-heading-row"><div><p className="eyebrow">HISTORY</p><h3>Progress entries</h3></div><span className="muted">{progressGoal.entries?.length || 0} entries</span></div>
              {progressGoal.entries?.length ? progressGoal.entries.map((entry) => (
                <div className="goal-history-row" key={entry.id}>
                  <div className={`goal-entry-icon ${entry.entry_type.toLowerCase()}`}>{entry.entry_type === 'Contribution' ? '+' : '−'}</div>
                  <div className="goal-history-copy"><strong>{entry.entry_type}</strong><span>{dateLabel(entry.contribution_date)}{entry.notes ? ` · ${entry.notes}` : ''}</span></div>
                  <strong className={entry.entry_type === 'Withdrawal' ? 'amount-expense' : 'amount-income'}>{entry.entry_type === 'Withdrawal' ? '−' : '+'}{money(entry.amount, progressGoal.currency)}</strong>
                  {!progressGoal.is_archived && <div className="goal-history-actions"><button className="text-button" onClick={() => editEntry(entry)}>Edit</button><button className="text-button danger-text" onClick={() => deleteEntry(entry)}>Delete</button></div>}
                </div>
              )) : <div className="empty-inline">No progress entries yet. The starting amount is {money(progressGoal.starting_amount, progressGoal.currency)}.</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
