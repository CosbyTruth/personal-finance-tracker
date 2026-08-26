import test from 'node:test'
import assert from 'node:assert/strict'
import { postingBlueprint } from '../server/data/ledger-repository.js'

test('income debits the receiving account and credits revenue', () => {
  assert.deepEqual(postingBlueprint({ transactionType: 'Income' }), [
    { role: 'source', side: 'Debit' },
    { role: 'category', side: 'Credit' },
  ])
})

test('expense debits expense and credits the paying account', () => {
  assert.deepEqual(postingBlueprint({ transactionType: 'Expense' }), [
    { role: 'category', side: 'Debit' },
    { role: 'source', side: 'Credit' },
  ])
})

test('transfer debits destination and credits source', () => {
  assert.deepEqual(postingBlueprint({ transactionType: 'Transfer' }), [
    { role: 'destination', side: 'Debit' },
    { role: 'source', side: 'Credit' },
  ])
})
