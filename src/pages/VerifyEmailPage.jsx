import { useState } from 'react'
import { apiRequest } from '../services/api.js'

export default function VerifyEmailPage({ email: initialEmail = '', onShowLogin }) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const data = await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      })
      setVerified(true)
      setMessage(data.message || 'Email verified. You can now sign in.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    setMessage('')
    if (!email) return setError('Enter your email address first.')
    setBusy(true)
    try {
      const data = await apiRequest('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(data.message || 'If the account is unverified, a new code has been sent.')
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
        <p className="eyebrow">EMAIL VERIFICATION</p>
        <h1>Prove the email belongs to you.</h1>
        <p className="lead">We only activate an account after the verification code sent to the mailbox is confirmed.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">VERIFY ACCOUNT</p>
          <h2>{verified ? 'Email verified' : 'Check your inbox'}</h2>

          {verified ? (
            <>
              <p className="success-message">{message}</p>
              <button className="primary-button full-button" onClick={onShowLogin}>Continue to sign in</button>
            </>
          ) : (
            <>
              <p className="muted">Enter the 6-digit code sent to your email. Codes expire after a short period.</p>
              <form onSubmit={submit}>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Verification code
                  <input
                    className="verification-code-input"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength="6"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    placeholder="123456"
                    required
                  />
                </label>
                {error && <p className="error-message">{error}</p>}
                {message && <p className="success-message">{message}</p>}
                <button className="primary-button" disabled={busy || code.length !== 6}>
                  {busy ? 'Checking…' : 'Verify email'}
                </button>
              </form>
              <div className="verification-actions">
                <button className="text-button" type="button" onClick={resend} disabled={busy}>Resend code</button>
                <button className="text-button" type="button" onClick={onShowLogin}>Back to sign in</button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
