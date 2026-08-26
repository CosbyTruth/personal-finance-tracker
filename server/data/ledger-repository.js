import { withTransaction } from './transaction-manager.js'

export class LedgerDataError extends Error {
  constructor(message, status = 400, code = 'LEDGER_VALIDATION') {
    super(message)
    this.name = 'LedgerDataError'
    this.status = status
    this.code = code
  }
}

export function postingBlueprint(transaction) {
  if (transaction.transactionType === 'Income') {
    return [
      { role: 'source', side: 'Debit' },
      { role: 'category', side: 'Credit' },
    ]
  }
  if (transaction.transactionType === 'Expense') {
    return [
      { role: 'category', side: 'Debit' },
      { role: 'source', side: 'Credit' },
    ]
  }
  if (transaction.transactionType === 'Transfer') {
    return [
      { role: 'destination', side: 'Debit' },
      { role: 'source', side: 'Credit' },
    ]
  }
  throw new LedgerDataError('Unsupported transaction type.')
}

async function loadRelations(client, userId, transaction, { requireActive = true } = {}) {
  const accountIds = [transaction.accountId]
  if (transaction.transferAccountId) accountIds.push(transaction.transferAccountId)

  const accounts = await client.query(
    `SELECT id, name, account_type, currency, is_archived
     FROM finance_accounts
     WHERE user_id = $1 AND id = ANY($2::bigint[])
     FOR SHARE`,
    [userId, accountIds],
  )
  const byId = new Map(accounts.rows.map((row) => [String(row.id), row]))
  const source = byId.get(String(transaction.accountId))
  const destination = transaction.transferAccountId ? byId.get(String(transaction.transferAccountId)) : null

  if (!source || (requireActive && source.is_archived)) {
    throw new LedgerDataError('The selected account was not found or is archived.')
  }
  if (transaction.transactionType === 'Transfer') {
    if (!destination || (requireActive && destination.is_archived)) {
      throw new LedgerDataError('The destination account was not found or is archived.')
    }
    if (String(destination.id) === String(source.id)) {
      throw new LedgerDataError('A transfer must use two different accounts.')
    }
    if (destination.currency !== source.currency) {
      throw new LedgerDataError('Transfers currently require accounts with the same currency.')
    }
    return { source, destination, category: null, currency: source.currency }
  }

  const categoryResult = await client.query(
    `SELECT id, name, category_type
     FROM finance_categories
     WHERE id = $1 AND user_id = $2
     FOR SHARE`,
    [transaction.categoryId, userId],
  )
  const category = categoryResult.rows[0]
  if (!category) throw new LedgerDataError('The selected category was not found.')
  if (category.category_type !== transaction.transactionType) {
    throw new LedgerDataError(
      `${transaction.transactionType} transactions must use a ${transaction.transactionType.toLowerCase()} category.`,
    )
  }
  return { source, destination: null, category, currency: source.currency }
}

async function ensureMappedLedgerAccounts(client, userId, transaction, relations) {
  const mappedAccounts = [relations.source]
  if (relations.destination) mappedAccounts.push(relations.destination)

  for (const account of mappedAccounts) {
    const isLiability = account.account_type === 'Credit'
    await client.query(
      `INSERT INTO ledger_accounts
       (user_id, finance_account_id, code, name, account_class, normal_side, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        userId,
        account.id,
        `ASSET:${account.id}`,
        account.name,
        isLiability ? 'Liability' : 'Asset',
        isLiability ? 'Credit' : 'Debit',
        account.currency,
      ],
    )
  }

  if (relations.category) {
    const isIncome = relations.category.category_type === 'Income'
    await client.query(
      `INSERT INTO ledger_accounts
       (user_id, category_id, code, name, account_class, normal_side)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [
        userId,
        relations.category.id,
        `${isIncome ? 'REVENUE' : 'EXPENSE'}:${relations.category.id}`,
        relations.category.name,
        isIncome ? 'Revenue' : 'Expense',
        isIncome ? 'Credit' : 'Debit',
      ],
    )
  }

  const ids = [relations.source.id]
  if (relations.destination) ids.push(relations.destination.id)
  const ledgerAccounts = await client.query(
    `SELECT id, finance_account_id, category_id
     FROM ledger_accounts
     WHERE user_id = $1
       AND (finance_account_id = ANY($2::bigint[]) OR category_id = $3)`,
    [userId, ids, relations.category?.id || null],
  )

  const source = ledgerAccounts.rows.find((row) => String(row.finance_account_id) === String(relations.source.id))
  const destination = relations.destination
    ? ledgerAccounts.rows.find((row) => String(row.finance_account_id) === String(relations.destination.id))
    : null
  const category = relations.category
    ? ledgerAccounts.rows.find((row) => String(row.category_id) === String(relations.category.id))
    : null

  if (!source || (relations.destination && !destination) || (relations.category && !category)) {
    throw new Error('Ledger account mapping could not be created')
  }
  return { source: source.id, destination: destination?.id, category: category?.id }
}

async function postJournal(client, { userId, legacyTransactionId, transaction, currency, ledgerAccountIds, idempotencyKey = null }) {
  const journalResult = await client.query(
    `INSERT INTO ledger_journals
     (user_id, journal_type, occurred_on, currency, description, notes, idempotency_key, legacy_transaction_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      userId,
      transaction.transactionType,
      transaction.transactionDate,
      currency,
      transaction.description,
      transaction.notes,
      idempotencyKey,
      legacyTransactionId,
    ],
  )
  const journalId = journalResult.rows[0].id
  const rows = postingBlueprint(transaction)
  for (const posting of rows) {
    await client.query(
      `INSERT INTO ledger_postings
       (user_id, journal_id, ledger_account_id, side, amount, currency)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, journalId, ledgerAccountIds[posting.role], posting.side, transaction.amount, currency],
    )
  }
  return journalId
}

async function reverseJournal(client, userId, current, reason) {
  const reversal = await client.query(
    `INSERT INTO ledger_journals
     (user_id, journal_type, occurred_on, currency, description, notes, reverses_journal_id)
     VALUES ($1,'Reversal',CURRENT_DATE,$2,$3,$4,$5)
     RETURNING id`,
    [userId, current.currency, `Reversal: ${current.description || 'transaction'}`, reason, current.id],
  )
  await client.query(
    `INSERT INTO ledger_postings (user_id, journal_id, ledger_account_id, side, amount, currency)
     SELECT user_id, $1, ledger_account_id,
            CASE side WHEN 'Debit' THEN 'Credit' ELSE 'Debit' END,
            amount, currency
     FROM ledger_postings
     WHERE journal_id=$2 AND user_id=$3`,
    [reversal.rows[0].id, current.id, userId],
  )
  await client.query(
    `UPDATE ledger_journals SET status='Reversed', reversed_at=NOW()
     WHERE id=$1 AND user_id=$2`,
    [current.id, userId],
  )
  return reversal.rows[0].id
}

async function reverseActiveJournal(client, userId, legacyTransactionId, reason) {
  const result = await client.query(
    `SELECT id, occurred_on, currency, description, notes
     FROM ledger_journals
     WHERE user_id=$1 AND legacy_transaction_id=$2 AND status='Posted' AND reverses_journal_id IS NULL
     FOR UPDATE`,
    [userId, legacyTransactionId],
  )
  if (!result.rowCount) return null
  return reverseJournal(client, userId, result.rows[0], reason)
}

async function ensureOpeningMappings(client, userId, account) {
  const isLiability = account.account_type === 'Credit'
  await client.query(
    `INSERT INTO ledger_accounts
     (user_id, finance_account_id, code, name, account_class, normal_side, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT DO NOTHING`,
    [userId, account.id, `ACCOUNT:${account.id}`, account.name, isLiability ? 'Liability' : 'Asset', isLiability ? 'Credit' : 'Debit', account.currency],
  )
  await client.query(
    `INSERT INTO ledger_accounts
     (user_id, code, name, account_class, normal_side, system_role)
     VALUES ($1,'SYSTEM:OPENING_BALANCE','Opening balance equity','Equity','Credit','OpeningBalance')
     ON CONFLICT DO NOTHING`,
    [userId],
  )
  const result = await client.query(
    `SELECT id, finance_account_id, system_role
     FROM ledger_accounts
     WHERE user_id=$1 AND (finance_account_id=$2 OR system_role='OpeningBalance')`,
    [userId, account.id],
  )
  return {
    account: result.rows.find((row) => String(row.finance_account_id) === String(account.id))?.id,
    equity: result.rows.find((row) => row.system_role === 'OpeningBalance')?.id,
  }
}

async function postOpeningBalance(client, userId, account, idempotencyKey = null) {
  const amount = String(account.opening_balance)
  if (Number(amount) === 0) return null
  const negative = amount.startsWith('-')
  const absoluteAmount = negative ? amount.slice(1) : amount
  const mappings = await ensureOpeningMappings(client, userId, account)
  if (!mappings.account || !mappings.equity) throw new Error('Opening balance ledger mapping could not be created')
  const journal = await client.query(
    `INSERT INTO ledger_journals
     (user_id, journal_type, occurred_on, currency, description, notes, idempotency_key)
     VALUES ($1,'OpeningBalance',CURRENT_DATE,$2,$3,$4,$5)
     RETURNING id`,
    [userId, account.currency, `Opening balance · ${account.name}`, 'Account opening balance', idempotencyKey],
  )
  const debitAccount = negative ? mappings.equity : mappings.account
  const creditAccount = negative ? mappings.account : mappings.equity
  await client.query(
    `INSERT INTO ledger_postings (user_id,journal_id,ledger_account_id,side,amount,currency)
     VALUES ($1,$2,$3,'Debit',$4,$5),($1,$2,$6,'Credit',$4,$5)`,
    [userId, journal.rows[0].id, debitAccount, absoluteAmount, account.currency, creditAccount],
  )
  return journal.rows[0].id
}

export function createFinancialAccount({ userId, account }) {
  return withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT id, is_archived FROM finance_accounts
       WHERE user_id=$1 AND LOWER(name)=LOWER($2)
       LIMIT 1`,
      [userId, account.name],
    )
    if (duplicate.rowCount) {
      const message = duplicate.rows[0].is_archived
        ? 'An archived account already uses this name. Restore or rename that account first.'
        : 'An account with this name already exists.'
      throw new LedgerDataError(message, 409, 'DUPLICATE_ACCOUNT')
    }
    const result = await client.query(
      `INSERT INTO finance_accounts (user_id,name,account_type,currency,opening_balance)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,name,account_type,currency,opening_balance,is_archived,created_at,updated_at`,
      [userId, account.name, account.accountType, account.currency, account.openingBalance],
    )
    const created = result.rows[0]
    await ensureOpeningMappings(client, userId, created)
    await postOpeningBalance(client, userId, created, `opening:${created.id}`)
    return created
  })
}

export function replaceFinancialAccount({ userId, accountId, account }) {
  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM finance_transactions t
         WHERE t.user_id=a.user_id AND (t.account_id=a.id OR t.transfer_account_id=a.id)) AS transaction_count
       FROM finance_accounts a
       WHERE a.id=$1 AND a.user_id=$2
       FOR UPDATE`,
      [accountId, userId],
    )
    if (!currentResult.rowCount) throw new LedgerDataError('Account not found.', 404, 'NOT_FOUND')
    const current = currentResult.rows[0]
    const duplicate = await client.query(
      `SELECT id FROM finance_accounts
       WHERE user_id=$1 AND LOWER(name)=LOWER($2) AND id<>$3
       LIMIT 1`,
      [userId, account.name, accountId],
    )
    if (duplicate.rowCount) throw new LedgerDataError('Another account already uses this name.', 409, 'DUPLICATE_ACCOUNT')
    if (current.transaction_count > 0) {
      if (current.currency !== account.currency) throw new LedgerDataError('Currency cannot be changed after transactions exist on an account.', 409, 'LOCKED_ACCOUNT_CURRENCY')
      if (Number(current.opening_balance) !== Number(account.openingBalance)) throw new LedgerDataError('Opening balance cannot be changed after transactions exist on an account.', 409, 'LOCKED_OPENING_BALANCE')
      if (current.account_type !== account.accountType) throw new LedgerDataError('Account type cannot be changed after transactions exist on an account.', 409, 'LOCKED_ACCOUNT_TYPE')
    }

    const openingChanged = Number(current.opening_balance) !== Number(account.openingBalance) || current.currency !== account.currency
    if (openingChanged && Number(current.opening_balance) !== 0) {
      const activeOpening = await client.query(
        `SELECT j.id,j.occurred_on,j.currency,j.description,j.notes
         FROM ledger_journals j
         JOIN ledger_postings p ON p.journal_id=j.id AND p.user_id=j.user_id
         JOIN ledger_accounts la ON la.id=p.ledger_account_id AND la.user_id=p.user_id
         WHERE j.user_id=$1 AND la.finance_account_id=$2
           AND j.journal_type='OpeningBalance' AND j.status='Posted' AND j.reverses_journal_id IS NULL
         ORDER BY j.created_at DESC LIMIT 1
         FOR UPDATE OF j`,
        [userId, accountId],
      )
      if (activeOpening.rowCount) await reverseJournal(client, userId, activeOpening.rows[0], 'Opening balance corrected')
    }

    const result = await client.query(
      `UPDATE finance_accounts
       SET name=$1,account_type=$2,currency=$3,opening_balance=$4,updated_at=NOW()
       WHERE id=$5 AND user_id=$6
       RETURNING *`,
      [account.name, account.accountType, account.currency, account.openingBalance, accountId, userId],
    )
    const updated = result.rows[0]
    const isLiability = updated.account_type === 'Credit'
    await client.query(
      `UPDATE ledger_accounts
       SET name=$1,account_class=$2,normal_side=$3,currency=$4
       WHERE user_id=$5 AND finance_account_id=$6`,
      [updated.name, isLiability ? 'Liability' : 'Asset', isLiability ? 'Credit' : 'Debit', updated.currency, userId, accountId],
    )
    if (openingChanged) await postOpeningBalance(client, userId, updated)
    return updated
  })
}

export async function createLedgerTransaction(client, {
  userId,
  transaction,
  idempotencyKey = null,
  requireActive = true,
}) {
  if (idempotencyKey) {
    const existing = await client.query(
      `SELECT legacy_transaction_id
       FROM ledger_journals
       WHERE user_id=$1 AND idempotency_key=$2 AND status='Posted'
       LIMIT 1`,
      [userId, idempotencyKey],
    )
    if (existing.rowCount) {
      return { id: existing.rows[0].legacy_transaction_id, replayed: true }
    }
  }

  const relations = await loadRelations(client, userId, transaction, { requireActive })
  const projection = await client.query(
    `INSERT INTO finance_transactions (
       user_id, account_id, transaction_type, category_id, transfer_account_id,
       amount, currency, description, notes, transaction_date
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      userId,
      transaction.accountId,
      transaction.transactionType,
      transaction.categoryId,
      transaction.transferAccountId,
      transaction.amount,
      relations.currency,
      transaction.description,
      transaction.notes,
      transaction.transactionDate,
    ],
  )
  const id = projection.rows[0].id
  const ledgerAccountIds = await ensureMappedLedgerAccounts(client, userId, transaction, relations)
  await postJournal(client, {
    userId,
    legacyTransactionId: id,
    transaction,
    currency: relations.currency,
    ledgerAccountIds,
    idempotencyKey,
  })
  return { id, replayed: false }
}

export function createTransaction(command) {
  return withTransaction((client) => createLedgerTransaction(client, command))
}

export function replaceTransaction({ userId, transactionId, transaction }) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM finance_transactions
       WHERE id=$1 AND user_id=$2
       FOR UPDATE`,
      [transactionId, userId],
    )
    if (!existing.rowCount) throw new LedgerDataError('Transaction not found.', 404, 'NOT_FOUND')

    const relations = await loadRelations(client, userId, transaction, { requireActive: false })
    await reverseActiveJournal(client, userId, transactionId, 'Transaction corrected')
    await client.query(
      `UPDATE finance_transactions
       SET account_id=$1, transaction_type=$2, category_id=$3, transfer_account_id=$4,
           amount=$5, currency=$6, description=$7, notes=$8, transaction_date=$9, updated_at=NOW()
       WHERE id=$10 AND user_id=$11`,
      [
        transaction.accountId,
        transaction.transactionType,
        transaction.categoryId,
        transaction.transferAccountId,
        transaction.amount,
        relations.currency,
        transaction.description,
        transaction.notes,
        transaction.transactionDate,
        transactionId,
        userId,
      ],
    )
    const ledgerAccountIds = await ensureMappedLedgerAccounts(client, userId, transaction, relations)
    await postJournal(client, {
      userId,
      legacyTransactionId: transactionId,
      transaction,
      currency: relations.currency,
      ledgerAccountIds,
    })
    return { id: transactionId }
  })
}

export function removeTransaction({ userId, transactionId }) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM finance_transactions
       WHERE id=$1 AND user_id=$2
       FOR UPDATE`,
      [transactionId, userId],
    )
    if (!existing.rowCount) throw new LedgerDataError('Transaction not found.', 404, 'NOT_FOUND')
    await reverseActiveJournal(client, userId, transactionId, 'Transaction removed from active records')
    await client.query(
      'DELETE FROM finance_transactions WHERE id=$1 AND user_id=$2',
      [transactionId, userId],
    )
    return { id: transactionId }
  })
}
