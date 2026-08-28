import { useMemo, useState } from 'react'
import PasswordInput from '../components/PasswordInput.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { apiRequest } from '../services/api.js'

function getPasswordChecks(password) {
  return {
    length: password.length >= 12 && password.length <= 72,
    variety: /[A-Za-z]/.test(password) && /[^A-Za-z]/.test(password),
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
    if (!strongEnough) return setError('Use at least 12 characters and combine letters with numbers, spaces or symbols.')
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
    <main className="kora-auth-shell register-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <section className="auth-story register-story">
        <div className="auth-ambient one" /><div className="auth-ambient two" />
        <div className="rail-brand auth-brand">
          <span className="kora-mark"><i /><i /><i /></span>
          <div><strong>Kora</strong><small>Money in rhythm</small></div>
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow">BUILD YOUR MONEY HOME</p>
          <h1>Give every plan a place to <em>grow</em>.</h1>
          <p>Bring accounts, spending, goals and recurring commitments into one beautifully clear workspace.</p>
        </div>
        <div className="journey-steps">
          <div><span>01</span><p><strong>Connect the picture</strong><small>Add the accounts you use every day.</small></p></div>
          <div><span>02</span><p><strong>Find your rhythm</strong><small>See patterns without spreadsheet work.</small></p></div>
          <div><span>03</span><p><strong>Move with purpose</strong><small>Turn goals into visible momentum.</small></p></div>
        </div>
      </section>

      <section className="auth-entry">
        <div className="auth-entry-inner register-inner">
          <div className="auth-welcome"><span className="auth-kicker">CREATE YOUR SPACE</span><h2>Let’s make money feel lighter.</h2><p>Start with your identity. Your first account comes next.</p></div>
          <form className="kora-auth-form" onSubmit={submit}>
            <div className="form-grid-two">
              <label>Your name<input value={form.name} onChange={(event) => change('name', event.target.value)} autoComplete="name" placeholder="Ama Mensah" minLength="2" maxLength="80" required /></label>
              <label>Email address<input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} autoComplete="email" placeholder="ama@example.com" maxLength="254" required /></label>
            </div>
            <PasswordInput label="Create a passphrase" value={form.password} onChange={(event) => change('password', event.target.value)} autoComplete="new-password" minLength={12} maxLength={72} />
            <div className="passphrase-meter" aria-live="polite">
              <span className={checks.length ? 'met' : ''}>12–72 characters</span>
              <span className={checks.variety ? 'met' : ''}>Letters + another character type</span>
            </div>
            <PasswordInput label="Confirm passphrase" value={form.confirm} onChange={(event) => change('confirm', event.target.value)} autoComplete="new-password" minLength={12} maxLength={72} />
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy || !strongEnough}>{busy ? 'Creating your space…' : 'Create my Kora workspace'}<span>→</span></button>
          </form>
          <p className="auth-switch">Already have a workspace? <button type="button" className="text-button" onClick={onShowLogin}>Sign in</button></p>
        </div>
      </section>
    </main>
  )
}
