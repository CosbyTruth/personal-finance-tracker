import { useState } from 'react'
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

export default function FinanceWorkspace({ user, onLoggedOut }) {
  const [view, setView] = useState('overview')
  const [transactionIntent, setTransactionIntent] = useState(null)

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } finally {
      onLoggedOut()
    }
  }

  function openTransactions(type = null) {
    setTransactionIntent(type ? { type, key: Date.now() } : null)
    setView('transactions')
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PF</span><span>Personal Finance</span></div>
        <nav className="workspace-nav" aria-label="Finance navigation">
          <button className={view === 'overview' ? 'nav-button active' : 'nav-button'} onClick={() => setView('overview')}>Overview</button>
          <button className={view === 'accounts' ? 'nav-button active' : 'nav-button'} onClick={() => setView('accounts')}>Accounts</button>
          <button className={view === 'transactions' ? 'nav-button active' : 'nav-button'} onClick={() => openTransactions()}>Transactions</button>
          <button className={view === 'budgets' ? 'nav-button active' : 'nav-button'} onClick={() => setView('budgets')}>Budgets</button>
          <button className={view === 'goals' ? 'nav-button active' : 'nav-button'} onClick={() => setView('goals')}>Goals</button>
          <button className={view === 'recurring' ? 'nav-button active' : 'nav-button'} onClick={() => setView('recurring')}>Recurring</button>
          <button className={view === 'analytics' ? 'nav-button active' : 'nav-button'} onClick={() => setView('analytics')}>Analytics</button>
          <button className={view === 'reports' ? 'nav-button active' : 'nav-button'} onClick={() => setView('reports')}>Reports</button>
          <button className={view === 'alerts' ? 'nav-button active' : 'nav-button'} onClick={() => setView('alerts')}>Alerts</button>
        </nav>
        <div className="user-actions"><span>{user.name}</span><button className="secondary-button compact" onClick={logout}>Sign out</button></div>
      </header>

      {view === 'overview' && (
        <DashboardPage
          onOpenAccounts={() => setView('accounts')}
          onOpenTransactions={openTransactions}
          onOpenBudgets={() => setView('budgets')}
          onOpenGoals={() => setView('goals')}
          onOpenRecurring={() => setView('recurring')}
          onOpenAnalytics={() => setView('analytics')}
          onOpenReports={() => setView('reports')}
          onOpenAlerts={() => setView('alerts')}
        />
      )}
      {view === 'accounts' && <AccountsPage />}
      {view === 'transactions' && <TransactionsPage intent={transactionIntent} />}
      {view === 'budgets' && <BudgetsPage />}
      {view === 'goals' && <GoalsPage />}
      {view === 'recurring' && <RecurringPage onOpenTransactions={openTransactions} />}
      {view === 'analytics' && <AnalyticsPage />}
      {view === 'reports' && <ReportsPage />}
      {view === 'alerts' && <AlertsPage onNavigate={(target) => setView(target)} />}
    </main>
  )
}
