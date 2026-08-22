# Milestone 10 — Netlify Deployment

This version is prepared for Netlify + Neon PostgreSQL.

## Before deployment

1. Copy your existing `.env` into this folder for local testing only.
2. Run:
   - `npm install`
   - `npm run env:check`
   - `npm run db:check`
   - `npm run db:init`
   - `npm run build`
3. Confirm `.env` is ignored by Git.

## GitHub

Create or update a repository named `personal-finance-tracker`, commit this project, and push the `main` branch.

## Netlify build configuration

The repository already contains `netlify.toml` with:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js: 24
- `NPM_FLAGS=--include=dev` so Vite is available during the build even if an accidental production install setting is present.

Do not manually set `NODE_ENV=production` in Netlify. It is unnecessary and can suppress development dependencies during install.

## Netlify environment variables

Add these in Netlify Project configuration > Environment variables:

- `DATABASE_URL` = your Neon pooled connection string
- `DATABASE_SSL` = `true`
- `DB_POOL_MAX` = `3`
- `DB_IDLE_TIMEOUT_MS` = `30000`
- `DB_CONNECT_TIMEOUT_MS` = `10000`
- `JWT_SECRET` = your long random JWT secret
- `JWT_EXPIRES_IN` = `7d`
- `COOKIE_SECURE` = `true`

If your Netlify plan exposes scopes, make sure runtime secrets include Functions scope.

Do not add `NODE_ENV`.

## Deploy tests

After Netlify reports a successful deploy, test in this order:

1. `/` — React login screen loads.
2. `/api/health` — returns API online JSON.
3. `/api/ready` — reports database `ok: true`.
4. Sign in using the Neon-backed account.
5. Create a small test transaction.
6. Refresh the browser and verify the record remains.
7. Test Overview, Accounts, Transactions, Budgets, Goals, Recurring, Analytics, Reports, and Alerts.
8. Test from a real phone over mobile data/Wi-Fi.

## If deployment fails

Open Deploys > failed deploy > Deploy log and capture the first real error plus approximately 20 lines above/below it. Do not change multiple settings at once.
