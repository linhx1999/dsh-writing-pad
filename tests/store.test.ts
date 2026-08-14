import assert from 'node:assert/strict'
import test from 'node:test'
import { createWritingPadStore } from '../src/client/store.ts'

test('store publishes immutable per-session snapshots', () => {
  const store = createWritingPadStore()
  const before = store.entryOf('one')
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications++ })

  store.setEntry('one', { draft: 'updated' })
  const after = store.entryOf('one')

  assert.notEqual(after, before)
  assert.equal(after.draft, 'updated')
  assert.equal(before.draft, '')
  assert.equal(store.entryOf('two').draft, '')
  assert.equal(notifications, 1)
  unsubscribe()
})
