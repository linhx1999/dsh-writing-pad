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

test('store keeps coalesced undo history isolated by session', () => {
  const store = createWritingPadStore()

  store.replaceDraft('one', 'first', { remember: true })
  store.replaceDraft('one', 'first edited')
  store.replaceDraft('one', 'second', { remember: true })

  assert.deepEqual(store.entryOf('one').undoStack, ['', 'first edited'])
  assert.equal(store.entryOf('two').undoStack.length, 0)
  assert.equal(store.undoDraft('one'), 'first edited')
  assert.equal(store.undoDraft('one'), '')
  assert.equal(store.undoDraft('one'), undefined)
})

test('store bounds undo history to fifty steps', () => {
  const store = createWritingPadStore()
  for (let index = 0; index < 55; index++) {
    store.replaceDraft('one', `draft-${index}`, { remember: true })
  }

  assert.equal(store.entryOf('one').undoStack.length, 50)
  assert.equal(store.undoDraft('one'), 'draft-53')
})
