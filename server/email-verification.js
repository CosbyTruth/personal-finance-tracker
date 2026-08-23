import crypto from 'node:crypto'

const CODE_TTL_MINUTES = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 10)
const RESEND_COOLDOWN_SECONDS = Number(process.env.EMAIL_VERIFICATION_RESEND_SECONDS || 60)
const MAX_ATTEMPTS = Number(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS || 5)

export function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export function hashVerificationCode(email, code) {
  const pepper = process.env.EMAIL_VERIFICATION_PEPPER || process.env.JWT_SECRET || ''
  return crypto
    .createHash('sha256')
    .update(`${String(email).toLowerCase()}:${code}:${pepper}`)
    .digest('hex')
}

export function verificationExpiry() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
}

export function verificationConfig() {
  return {
    ttlMinutes: CODE_TTL_MINUTES,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    maxAttempts: MAX_ATTEMPTS,
  }
}

export async function sendVerificationEmail({ email, name, code }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const isCloud = process.env.NETLIFY === 'true' || process.env.CONTEXT === 'production'

  if (!apiKey || !from) {
    if (isCloud) {
      throw new Error('Email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM.')
    }

    console.log(`\n[DEV EMAIL VERIFICATION] ${email} → ${code}\n`)
    return { development: true }
  }

  const safeName = String(name || 'there').replace(/[<>&"']/g, '')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verify your Personal Finance email',
      text: `Hi ${safeName},\n\nYour Personal Finance verification code is ${code}.\n\nThis code expires in ${CODE_TTL_MINUTES} minutes. If you did not create this account, you can ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172019">
          <h2>Verify your email</h2>
          <p>Hi ${safeName},</p>
          <p>Enter this code in Personal Finance to verify your email address:</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:18px 20px;background:#f1f8f3;border-radius:12px;text-align:center">${code}</div>
          <p style="margin-top:20px">This code expires in ${CODE_TTL_MINUTES} minutes.</p>
          <p style="color:#66736a">If you did not create this account, you can ignore this email.</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Email provider rejected the verification email (${response.status}). ${detail}`)
  }

  return response.json().catch(() => ({ ok: true }))
}
