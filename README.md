# Personal Finance Tracker — Milestone 10

## Production Deployment

Milestone 10 takes the full-width, fully responsive Milestone 9 application online using Netlify for the React/Vite frontend and Express serverless API, with Neon PostgreSQL as the shared database.

All existing finance features remain: accounts, transactions, budgets, goals, recurring cash flow, analytics, reports, alerts, authentication, multi-currency-safe accounting, and responsive layouts.

### Local verification

```powershell
npm install
npm run env:check
npm run db:check
npm run db:init
npm run build
npm run dev
```

See `DEPLOYMENT.md` for the complete Netlify deployment procedure and `MOBILE_APP_ROADMAP.md` for the native Android/iOS plan that follows deployment.
