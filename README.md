# Kora Money

Kora Money is a creative, privacy-minded personal finance workspace for accounts,
cash activity, spending plans, savings goals, recurring money, analytics, reports,
and proactive signals.

The product uses React 19 and Vite for the client, Express 5 for the API, and
PostgreSQL for durable financial data. PostgreSQL remains the right primary
database at scale: financial records benefit from ACID transactions, constraints,
relational reporting, mature backup tooling, and read replicas.

## What changed in this redesign

- A new Kora Money visual system, responsive product rail, mobile dock, richer
  sign-in/onboarding experience, and consistent product language.
- A double-entry, append-only ledger behind the existing transaction experience.
  Every entry balances debits and credits; edits and deletes create reversals.
- Transaction writes use a repository and transaction manager, with tenant
  ownership checks and optional idempotency keys.
- Versioned, checksummed PostgreSQL migrations serialized by an advisory lock.
- Goal allocation changes are serialized to prevent concurrent withdrawals from
  producing a negative balance.
- Recurring forecasts count every occurrence in the next 30 days and preserve
  month-end anchors such as the 31st.
- Database-backed sign-in throttling, safer password rules, verified TLS defaults,
  origin validation, security headers, request timeouts, and safe CSV export.
- A deployment-aware client data layer that supports same-origin web hosting or a
  separately hosted API for Capacitor builds.

See ARCHITECTURE.md for the ledger model, write lifecycle, scale plan, and
operational decisions.

## Local setup

Requirements: Node.js 24 and PostgreSQL 15 or newer.

1. Copy .env.example to .env and set DATABASE_URL and a long random JWT_SECRET.
2. Install dependencies with npm install.
3. Initialize a new database with npm run db:init.
4. Start the API and client with npm run dev.
5. Open http://localhost:5174.

For an existing database, take a verified backup and run npm run db:migrate.
The ledger migration is additive and backfills current accounts, opening balances,
categories, and transactions. Do not edit an already-applied migration; create the
next numbered SQL file.

## Quality and deployment checks

Run npm test, npm run check, npm run env:check, npm run db:check, and
npm audit --omit=dev before release.

Netlify uses netlify.toml to build the client and route /api/* to the serverless
Express adapter. Set DATABASE_SSL=verify-full, COOKIE_SECURE=true, and the
production origin in APP_ORIGINS when the API is hosted separately.

For Capacitor, compile with VITE_API_BASE_URL set to the deployed HTTPS API, add
the Capacitor origin to APP_ORIGINS, and use COOKIE_SAME_SITE=none with
COOKIE_SECURE=true.

## Important data rules

- Never update or delete ledger postings directly.
- Correct posted money with reversal journals.
- Keep one currency per journal. Model future FX transfers as linked journals with
  an explicit rate.
- Treat finance_transactions as the compatibility projection used by current
  screens. The balanced ledger is the audit source of truth.
- Archived accounts still contribute to net worth and historical analytics.
