# Kora Money database migrations

Run `npm run db:init` for a new database. Run `npm run db:migrate` when deploying
an existing database. Migrations are serialized with a PostgreSQL advisory lock,
checksummed, and committed one file at a time.

The ledger tables are append-only. Product screens continue to read the
`finance_transactions` compatibility projection while transaction writes are
committed atomically to both the projection and the balanced ledger.
