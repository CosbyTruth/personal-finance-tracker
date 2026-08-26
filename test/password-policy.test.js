import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePassword } from '../server/password-policy.js'

test('accepts a long passphrase with character variety', () => {
  assert.equal(validatePassword('correct horse battery staple 7').valid, true)
})

test('rejects short and single-type passwords', () => {
  assert.equal(validatePassword('Short7!').valid, false)
  assert.equal(validatePassword('abcdefghijklmnop').valid, false)
})
