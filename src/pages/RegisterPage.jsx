import { useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'

function getPasswordChecks(password) {
  return {
    length: password.length >= 8 && password.length <= 15,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9\s]/.test(password),
  }
}

export default function RegisterPage({ onAuthenticated, onShowLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const checks = useMemo(() => getPasswordChecks(form.password), [form.password])
  const strongEnough = Object.values(checks).every(Boolean)

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!strongEnough) return setError('Choose a password that meets every requirement below.')
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
        <p className="lead">Create your account with a strong, unique password you do not reuse on other services.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">NEW ACCOUNT</p>
          <h2>Create your profile</h2>
          <form onSubmit={submit}>
            <label>Name<input value={form.name} onChange={(e) => change('name', e.target.value)} autoComplete="name" minLength="2" maxLength="80" required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => change('email', e.target.value)} autoComplete="email" maxLength="254" required /></label>
            <label>
              Password
              <input type="password" value={form.password} onChange={(e) => change('password', e.target.value)} autoComplete="new-password" minLength="8" maxLength="15" required />
            </label>
            <div className="password-guidance" aria-live="polite">
              <p>Password requirements:</p>
              <ul>
                <li className={checks.length ? 'met' : ''}>8–15 characters</li>
                <li className={checks.uppercase ? 'met' : ''}>At least one uppercase letter</li>
                <li className={checks.lowercase ? 'met' : ''}>At least one lowercase letter</li>
                <li className={checks.number ? 'met' : ''}>At least one number</li>
                <li className={checks.special ? 'met' : ''}>At least one special character, e.g. ! @ # $ %</li>
              </ul>
              <small>Use a password that is unique to this app.</small>
            </div>
            <label>Confirm password<input type="password" value={form.confirm} onChange={(e) => change('confirm', e.target.value)} autoComplete="new-password" minLength="8" maxLength="15" required /></label>
            {error && <p className="error-message">{error}</p>}
            <button className="primary-button" disabled={busy || !strongEnough}>{busy ? 'Creating…' : 'Create account'}</button>
          </form>
          <p className="switch-copy">Already registered? <button className="text-button" onClick={onShowLogin}>Sign in</button></p>
        </div>
      </section>
    </main>
  )
}
