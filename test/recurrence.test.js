import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceRecurringDate, recurringOccurrencesInRange } from '../server/domain/recurrence.js'

test('month-end recurrence returns to its anchor after February', () => {
  assert.equal(advanceRecurringDate('2028-01-31', 'Monthly', 31), '2028-02-29')
  assert.equal(advanceRecurringDate('2028-02-29', 'Monthly', 31), '2028-03-31')
})

test('30-day forecast includes every weekly occurrence', () => {
  assert.deepEqual(recurringOccurrencesInRange({
    nextDueDate: '2026-08-01', frequency: 'Weekly', from: '2026-08-01', to: '2026-08-30',
  }), ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29'])
})
