# Personal Finance Tracker — Schema through Milestone 8

Milestone 8 does not create a reporting ledger or duplicate financial totals. Reports are query-time views of the existing source-of-truth tables.

## Core identity

- `users`

## Finance ledger

- `finance_accounts`
- `finance_categories`
- `finance_transactions`

## Planning and targets

- `finance_budgets`
- `finance_savings_goals`
- `finance_goal_contributions`
- `finance_recurring_items`
- `finance_recurring_occurrences`

## Analytics and reports

No `finance_analytics` or `finance_reports` table exists by design.

Milestone 7 analytics and Milestone 8 reports derive their results from the ledger and related planning tables.

The report endpoint derives, for one currency and date range:

- total income
- total expenses
- net cash flow
- cash-flow savings rate
- transfer volume
- transaction counts
- expense category totals/shares
- income category totals/shares
- account inflow/outflow/net movement
- monthly cash-flow buckets
- transaction statement rows for export/printing

## Important definitions

Cash-flow savings rate:

```text
(Income - Expenses) / Income × 100
```

Transfers are internal movement and therefore have zero cash-flow impact.

Account activity is different from cash flow. For example, a transfer into MTN MoMo is an inflow to that account, even though it is not Income for the person as a whole.

Goal contributions are allocations and are not silently converted into Expense or Transfer transactions.

Currencies remain separate until an explicit FX model is introduced.

## Existing performance index

Milestone 7 already adds:

```sql
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_currency_date
  ON finance_transactions(user_id, currency, transaction_date DESC);
```

Milestone 8 reuses this index for date-range/currency report queries and requires no additional table migration.
