# Email Verification & Password Security Update

This update prevents newly registered accounts from using the finance tracker until the email address is verified.

## Registration flow

1. User enters name, email, and a strong password.
2. The backend creates the account as `email_verified = false`.
3. A six-digit code is generated with cryptographically secure randomness.
4. Only a SHA-256 hash of the code is stored in PostgreSQL.
5. The code is emailed to the user through Resend.
6. The code expires after 10 minutes and allows at most 5 incorrect attempts.
7. After successful verification, the code is destroyed and the account can sign in.

Existing accounts are automatically marked verified when the migration runs, so current users are not locked out.

## Password policy

New passwords must contain:

- Between 8 and 15 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one non-whitespace special character such as `!`, `@`, `#`, `$`, or `%`

The registration page shows a live checklist and recommends using a unique password and a password manager.

## Local installation

Copy your existing `.env` into this project, then add:

```env
RESEND_API_KEY=REPLACE_WITH_RESEND_API_KEY
EMAIL_FROM=Personal Finance <verify@your-verified-domain.com>
EMAIL_VERIFICATION_TTL_MINUTES=10
EMAIL_VERIFICATION_RESEND_SECONDS=60
EMAIL_VERIFICATION_MAX_ATTEMPTS=5
EMAIL_VERIFICATION_PEPPER=REPLACE_WITH_ANOTHER_LONG_RANDOM_SECRET
```

Generate a pepper with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

If `RESEND_API_KEY` / `EMAIL_FROM` are omitted during local development, the verification code is printed in the API terminal instead of being emailed. Cloud deployment deliberately refuses to silently fall back to console codes.

Then run:

```powershell
npm install
npm run db:init
npm run dev
```

## Resend setup

1. Create an account at Resend.
2. Create an API key.
3. For testing, Resend's `resend.dev` sender can only send to the email address associated with your Resend account.
4. To verify arbitrary users, add a domain you own to Resend and verify the SPF/DKIM DNS records.
5. Set `EMAIL_FROM` to an address at the exact verified domain, for example:

```text
Personal Finance <verify@mail.example.com>
```

If the verified domain is `mail.example.com`, the From address must use `@mail.example.com`.

## Netlify environment variables

Add these in Netlify Project configuration → Environment variables, with Functions scope when available:

```text
RESEND_API_KEY
EMAIL_FROM
EMAIL_VERIFICATION_TTL_MINUTES=10
EMAIL_VERIFICATION_RESEND_SECONDS=60
EMAIL_VERIFICATION_MAX_ATTEMPTS=5
EMAIL_VERIFICATION_PEPPER
```

Keep the existing database/JWT variables too.

Do not commit any of these secrets to GitHub.

After adding the variables, use **Clear cache and deploy site**.

## Database migration

Run:

```powershell
npm run db:init
```

The migration adds these fields to `users`:

```text
email_verified
email_verified_at
email_verification_code_hash
email_verification_expires_at
email_verification_sent_at
email_verification_attempts
```

It does not delete finance data.

## Production test

1. Register with an email address you can access.
2. Confirm that registration does not log you in.
3. Confirm a 6-digit code arrives by email.
4. Enter a wrong code and confirm it is rejected.
5. Enter the correct code and confirm verification succeeds.
6. Sign in.
7. Register another account with a dummy/unreachable email and confirm it cannot sign in without verification.
8. Confirm a weak password such as `password123` is rejected.
9. Confirm a password between 8 and 15 characters with uppercase, lowercase, a number, and a special character passes.

## Important

Email verification proves mailbox access; it does not prove a person's real-world identity. It prevents someone from activating an account using an email inbox they cannot access.
