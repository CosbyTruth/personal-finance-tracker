import { useState } from 'react'
import { apiRequest } from '../services/api.js'

export default function RegisterPage({ onAuthenticated, onShowLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match')

    setBusy(true)
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
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
        <p className="eyebrow">YOUR PRIVATE LEDGER</p>
        <h1>Build the financial picture once.</h1>
        <p className="lead">Your login can later connect back into the Personal Command Center without changing the finance data model.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">NEW ACCOUNT</p>
          <h2>Create your profile</h2>
          <form onSubmit={submit}>
            <label>Name<input value={form.name} onChange={(e) => change('name', e.target.value)} autoComplete="name" required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => change('email', e.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={form.password} onChange={(e) => change('password', e.target.value)} autoComplete="new-password" minLength="8" required /></label>
            <label>Confirm password<input type="password" value={form.confirm} onChange={(e) => change('confirm', e.target.value)} autoComplete="new-password" minLength="8" required /></label>
            {error && <p className="error-message">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          </form>
          <p className="switch-copy">Already registered? <button className="text-button" onClick={onShowLogin}>Sign in</button></p>
        </div>
      </section>
    </main>
  )
}
