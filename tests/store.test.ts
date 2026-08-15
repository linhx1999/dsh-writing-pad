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

test('store propagates default requirements without overwriting custom notes', () => {
  const store = createWritingPadStore('默认 A')
  assert.equal(store.entryOf('one').rewriteNote, '默认 A')
  store.setEntry('one', { rewriteNote: '当前会话自定义' })
  store.entryOf('two')

  store.setDefaultRewriteNote('默认 B')

  assert.equal(store.entryOf('one').rewriteNote, '当前会话自定义')
  assert.equal(store.entryOf('two').rewriteNote, '默认 B')
  assert.equal(store.entryOf('three').rewriteNote, '默认 B')
})

test('new sessions inherit the shared writing-pad visibility', () => {
  const store = createWritingPadStore()
  store.entryOf('two')
  store.setEntry('one', { open: true })
  assert.equal(store.entryOf('two').open, true)

  store.setEntry('two', { open: false })
  assert.equal(store.entryOf('three').open, false)
})
