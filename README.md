# Personal Finance Tracker — Milestone 10

Production-ready responsive Finance Tracker for Netlify + Neon PostgreSQL.

## Authentication

- Email/password registration and login.
- Passwords are hashed with bcrypt.
- New passwords must be 8–15 characters and include uppercase, lowercase, a number, and a special character.
- Email ownership verification is intentionally **not enabled** in this version.
- Registration signs the user in immediately after the account is created.

## Local setup

1. Copy `.env.example` to `.env` and add your database/JWT values.
2. Run `npm install`.
3. Run `npm run env:check`.
4. Run `npm run db:check`.
5. Run `npm run db:init`.
6. Run `npm run dev`.

Frontend: `http://localhost:5174`
API: `http://localhost:5001`
