import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDateKeysInTimeZone } from '../src/utils/dateKeys'

test('buildDateKeysInTimeZone uses local calendar day in target timezone', () => {
  const start = new Date('2026-03-23T02:30:00.000Z')
  const dates = buildDateKeysInTimeZone(start, 3, 'America/New_York')

  assert.deepEqual(dates, ['2026-03-22', '2026-03-23', '2026-03-24'])
})
