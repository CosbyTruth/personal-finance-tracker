import { useState } from 'react'
import { apiRequest } from '../services/api.js'

export default function LoginPage({ onAuthenticated, onShowRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      onAuthenticated(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand"><span className="brand-mark">PF</span><span>Personal Finance</span></div>
        <p className="eyebrow">MILESTONE 3 · TRANSACTIONS</p>
        <h1>Know where your money stands.</h1>
        <p className="lead">A private finance system for accounts, income, expenses, transfers, budgets and savings goals.</p>
        <div className="feature-strip"><span>GHS first</span><span>Multi-currency ready</span><span>PostgreSQL</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in</h2>
          <p className="muted">Use the account connected to your finance database.</p>
          <form onSubmit={submit}>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="error-message">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="switch-copy">No account yet? <button className="text-button" onClick={onShowRegister}>Create one</button></p>
        </div>
      </section>
    </main>
  )
}
