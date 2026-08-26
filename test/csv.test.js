import test from 'node:test'
import assert from 'node:assert/strict'
import { safeCsvCell } from '../src/utils/csv.js'

test('neutralizes spreadsheet formulas in exported text', () => {
  assert.equal(safeCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"')
  assert.equal(safeCsvCell('  +1+1'), "'  +1+1")
})

test('quotes commas and doubles quotes', () => {
  assert.equal(safeCsvCell('food, "lunch"'), '"food, ""lunch"""')
})
