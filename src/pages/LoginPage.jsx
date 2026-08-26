import { useState } from 'react'
import PasswordInput from '../components/PasswordInput.jsx'
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
    <main className="kora-auth-shell">
      <section className="auth-story">
        <div className="auth-ambient one" /><div className="auth-ambient two" />
        <div className="rail-brand auth-brand">
          <span className="kora-mark"><i /><i /><i /></span>
          <div><strong>Kora</strong><small>Money in rhythm</small></div>
        </div>

        <div className="auth-story-copy">
          <p className="eyebrow">A CALMER WAY TO SEE MONEY</p>
          <h1>Clarity for every <em>cedi</em>, goal and tomorrow.</h1>
          <p>Kora turns daily transactions into a living picture of where you are—and where you are going.</p>
        </div>

        <div className="auth-pulse-card">
          <div><span>This month</span><strong>Your financial pulse</strong></div>
          <div className="pulse-visual" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="pulse-legend"><span><i className="mint" />Cash flow</span><span><i className="sun" />Momentum</span></div>
        </div>
      </section>

      <section className="auth-entry">
        <div className="auth-entry-inner">
          <div className="auth-welcome">
            <span className="auth-kicker">WELCOME BACK</span>
            <h2>Step into your money space.</h2>
            <p>Your ledger is private, current and ready when you are.</p>
          </div>

          <form className="kora-auth-form" onSubmit={submit}>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
            <PasswordInput label="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Opening Kora…' : 'Enter your workspace'}<span>→</span></button>
          </form>

          <p className="auth-switch">New to Kora? <button type="button" className="text-button" onClick={onShowRegister}>Create your money space</button></p>
          <div className="auth-trust"><span>Encrypted sessions</span><span>Exact currency math</span><span>Private by design</span></div>
        </div>
      </section>
    </main>
  )
}
