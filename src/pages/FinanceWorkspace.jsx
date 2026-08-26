import { useMemo, useState } from 'react'
import AccountsPage from './AccountsPage.jsx'
import DashboardPage from './DashboardPage.jsx'
import BudgetsPage from './BudgetsPage.jsx'
import GoalsPage from './GoalsPage.jsx'
import TransactionsPage from './TransactionsPage.jsx'
import RecurringPage from './RecurringPage.jsx'
import AnalyticsPage from './AnalyticsPage.jsx'
import ReportsPage from './ReportsPage.jsx'
import AlertsPage from './AlertsPage.jsx'
import { apiRequest } from '../services/api.js'

const NAV_ITEMS = [
  { id: 'overview', label: 'Home', glyph: '⌂', description: 'Your daily money pulse' },
  { id: 'accounts', label: 'Accounts', glyph: '◫', description: 'Balances and wallets' },
  { id: 'transactions', label: 'Activity', glyph: '↕', description: 'Money in and out' },
  { id: 'budgets', label: 'Plan', glyph: '◒', description: 'Monthly spending map' },
  { id: 'goals', label: 'Goals', glyph: '◇', description: 'What you are building' },
  { id: 'recurring', label: 'Rhythm', glyph: '↻', description: 'Bills and income cycles' },
  { id: 'analytics', label: 'Insights', glyph: '⌁', description: 'Patterns in your money' },
  { id: 'reports', label: 'Reports', glyph: '▤', description: 'Statements and exports' },
  { id: 'alerts', label: 'Signals', glyph: '•', description: 'What needs attention' },
]

function initials(name) {
  return String(name || 'Kora User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function FinanceWorkspace({ user, onLoggedOut }) {
  const [view, setView] = useState('overview')
  const [transactionIntent, setTransactionIntent] = useState(null)
  const [railOpen, setRailOpen] = useState(false)
  const activeItem = useMemo(() => NAV_ITEMS.find((item) => item.id === view) || NAV_ITEMS[0], [view])

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } finally {
      onLoggedOut()
    }
  }

  function navigate(nextView) {
    setView(nextView)
    setRailOpen(false)
  }

  function openTransactions(type = null) {
    setTransactionIntent(type ? { type, key: Date.now() } : null)
    navigate('transactions')
  }

  return (
    <main className="app-frame">
      <button
        className={`rail-scrim ${railOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => setRailOpen(false)}
      />

      <aside className={`app-rail ${railOpen ? 'open' : ''}`}>
        <div className="rail-brand" aria-label="Kora Money">
          <span className="kora-mark"><i /><i /><i /></span>
          <div><strong>Kora</strong><small>Money in rhythm</small></div>
        </div>

        <div className="rail-caption">YOUR SPACE</div>
        <nav className="rail-nav" aria-label="Finance navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'rail-link active' : 'rail-link'}
              onClick={() => item.id === 'transactions' ? openTransactions() : navigate(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span className="rail-glyph" aria-hidden="true">{item.glyph}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>

        <div className="rail-note">
          <span className="rail-note-orbit" aria-hidden="true" />
          <small>KORA NOTE</small>
          <strong>Small moves become momentum.</strong>
          <p>Keep today’s money decisions visible and intentional.</p>
        </div>
      </aside>

      <section className="app-stage">
        <header className="stage-bar">
          <div className="stage-title-group">
            <button className="mobile-menu-button" onClick={() => setRailOpen(true)} aria-label="Open navigation">☰</button>
            <div><small>{activeItem.description}</small><strong>{activeItem.label}</strong></div>
          </div>

          <div className="stage-actions">
            <button className="quick-capture" onClick={() => openTransactions('Expense')}>
              <span>＋</span> Quick add
            </button>
            <div className="sync-pill"><i /> Secure ledger</div>
            <div className="profile-chip">
              <span>{initials(user.name)}</span>
              <div><strong>{user.name}</strong><small>{user.email}</small></div>
            </div>
            <button className="signout-button" onClick={logout}>Sign out</button>
          </div>
        </header>

        <div className="stage-content">
          {view === 'overview' && (
            <DashboardPage
              onOpenAccounts={() => navigate('accounts')}
              onOpenTransactions={openTransactions}
              onOpenBudgets={() => navigate('budgets')}
              onOpenGoals={() => navigate('goals')}
              onOpenRecurring={() => navigate('recurring')}
              onOpenAnalytics={() => navigate('analytics')}
              onOpenReports={() => navigate('reports')}
              onOpenAlerts={() => navigate('alerts')}
            />
          )}
          {view === 'accounts' && <AccountsPage />}
          {view === 'transactions' && <TransactionsPage intent={transactionIntent} />}
          {view === 'budgets' && <BudgetsPage />}
          {view === 'goals' && <GoalsPage />}
          {view === 'recurring' && <RecurringPage onOpenTransactions={openTransactions} />}
          {view === 'analytics' && <AnalyticsPage />}
          {view === 'reports' && <ReportsPage />}
          {view === 'alerts' && <AlertsPage onNavigate={navigate} />}
        </div>
      </section>

      <nav className="mobile-dock" aria-label="Primary mobile navigation">
        {NAV_ITEMS.slice(0, 5).map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => item.id === 'transactions' ? openTransactions() : navigate(item.id)}>
            <span aria-hidden="true">{item.glyph}</span><small>{item.label}</small>
          </button>
        ))}
        <button onClick={() => setRailOpen(true)}><span aria-hidden="true">•••</span><small>More</small></button>
      </nav>
    </main>
  )
}
