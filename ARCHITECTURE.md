# Kora Money architecture

## System shape

React feature screens call a client HTTP boundary that owns timeouts, normalized
errors, API origins, and idempotency. Express controllers authenticate the request
and hand money commands to a transaction manager and ledger repository. PostgreSQL
commits the ledger and compatibility projection together.

The current deployment remains a modular monolith. This is deliberate: money
movements, journals, and their projection commit in one database transaction.
Splitting this write path into services too early would trade strong consistency
for distributed failure modes.

## Ledger model

ledger_accounts is the chart of accounts. Product accounts map to Asset or
Liability accounts; finance categories map to Revenue or Expense accounts; opening
balances use a system Equity account.

ledger_journals describes a business event. ledger_postings contains its debits
and credits. Deferred database constraints require at least two postings and equal
debit and credit totals per currency at commit. Tenant-aware composite foreign keys
prevent postings from crossing user boundaries.

Posted rows are immutable. A correction creates an opposite journal, marks the
original journal Reversed, then posts the corrected journal. The original record
therefore remains available for audit.

- Income: debit the receiving account; credit its revenue category.
- Expense: debit the expense category; credit the paying account.
- Transfer: debit the destination account; credit the source account.
- Positive opening balance: debit the account; credit opening-balance equity.

finance_transactions remains an atomic compatibility projection. Existing reports
and UI screens can evolve without a flag-day rewrite, while ledger truth remains
available for reconciliation and future statements.

## Write lifecycle

1. Validate the command and tenant-owned relations.
2. Start a PostgreSQL transaction and lock relevant rows.
3. Write the compatibility projection.
4. Resolve chart-of-account mappings.
5. Write the journal and balanced postings.
6. Commit and run deferred balance constraints.
7. Return the refreshed projection.

Transaction creation accepts Idempotency-Key. Recurring postings use a stable key
derived from schedule and due date, protecting retries and duplicate serverless
execution.

## Scaling path

- More API traffic: stateless API instances, bounded pools, then a managed pooler.
- Heavy dashboards: indexed projections, short caches, then read replicas or
  materialized views.
- Large journal history: keyset pagination, then time partitioning.
- Long exports: cursor or streamed exports, then background jobs and object storage.
- Bank imports: idempotent ingestion records, then queues and worker consumers.
- Notifications: a transactional outbox, then dedicated event workers.
- Stronger tenant isolation: composite tenant keys, then PostgreSQL row-level
  security.

PostgreSQL should remain the system of record. Redis may cache derived reads and
coordinate jobs, but should not own balances. Object storage should hold generated
exports and attachments, not journal truth.

## Operations

- Run migrations as a release step before new application code receives traffic.
- Back up and restore-test PostgreSQL; enable point-in-time recovery in production.
- Monitor pool saturation, query latency, lock waits, failed constraints, sign-in
  throttles, and journal/projection reconciliation.
- Add scheduled reconciliation before enabling bank synchronization.
- Introduce request IDs and structured logs before multi-instance production traffic.

## Next bounded contexts

The route layer still contains mature read-model queries for budgets, goals,
analytics, reports, and signals. As each area grows, move its queries into a feature
repository without changing the ledger write contract. Keep cross-feature reporting
in explicit read-model modules rather than hiding it behind write models.
