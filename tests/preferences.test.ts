import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearReviewDecision,
  loadDefaultRewriteNote,
  loadReviewDecision,
  saveDefaultRewriteNote,
  saveReviewDecision,
} from '../src/client/preferences.ts'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear() { values.clear() },
    getItem(key) { return values.get(key) ?? null },
    key(index) { return [...values.keys()][index] ?? null },
    removeItem(key) { values.delete(key) },
    setItem(key, value) { values.set(key, value) },
  }
}

test('default rewrite requirement persists and clears', () => {
  const storage = memoryStorage()
  assert.equal(loadDefaultRewriteNote(storage), '')
  assert.equal(saveDefaultRewriteNote('更简洁', storage), true)
  assert.equal(loadDefaultRewriteNote(storage), '更简洁')
  assert.equal(saveDefaultRewriteNote('', storage), true)
  assert.equal(loadDefaultRewriteNote(storage), '')
})

test('review decisions remain isolated by session', () => {
  const storage = memoryStorage()
  assert.equal(saveReviewDecision('one', { reviewId: 'r1', decision: 'accept' }, storage), true)
  assert.equal(saveReviewDecision('two', { reviewId: 'r2', decision: 'reject' }, storage), true)
  assert.deepEqual(loadReviewDecision('one', storage), { reviewId: 'r1', decision: 'accept' })
  assert.equal(clearReviewDecision('one', storage), true)
  assert.equal(loadReviewDecision('one', storage), null)
  assert.deepEqual(loadReviewDecision('two', storage), { reviewId: 'r2', decision: 'reject' })
})
