import { useEffect, useState } from 'react'
import FinanceWorkspace from './pages/FinanceWorkspace.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import { apiRequest } from './services/api.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState('login')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <span className="brand-mark">K</span>
          <p>Tuning your money workspace…</p>
        </div>
      </main>
    )
  }

  if (user) return <FinanceWorkspace user={user} onLoggedOut={() => setUser(null)} />

  if (screen === 'register') {
    return <RegisterPage onAuthenticated={setUser} onShowLogin={() => setScreen('login')} />
  }

  return <LoginPage onAuthenticated={setUser} onShowRegister={() => setScreen('register')} />
}
