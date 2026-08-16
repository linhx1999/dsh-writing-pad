import assert from 'node:assert/strict'
import test from 'node:test'
import {
  blankDetailsWidth,
  currentBlankSessionId,
  firstGridTrackWidth,
  shouldOpenHostDetails,
} from '../src/client/blank-session.ts'

test('currentBlankSessionId selects only the current blank session', () => {
  const byId = {
    blank: { blank: true },
    active: { blank: false },
  }

  assert.equal(currentBlankSessionId({ current: 'blank', byId }), 'blank')
  assert.equal(currentBlankSessionId({ current: 'active', byId }), undefined)
  assert.equal(currentBlankSessionId({ current: 'missing', byId }), undefined)
  assert.equal(currentBlankSessionId({ current: undefined, byId }), undefined)
})

test('an open writing pad returns to the host details column after the first prompt', () => {
  assert.equal(shouldOpenHostDetails(true, true), false)
  assert.equal(shouldOpenHostDetails(false, true), true)
  assert.equal(shouldOpenHostDetails(false, false), false)
})

test('blankDetailsWidth follows the details concession used by ui-layout', () => {
  assert.equal(blankDetailsWidth(1280, 280), 360)
  assert.equal(blankDetailsWidth(1240, 280), 320)
  assert.equal(blankDetailsWidth(1219, 280), 0)
  assert.equal(blankDetailsWidth(1024, 56), 328)
})

test('firstGridTrackWidth reads ui-layout inline grid templates', () => {
  assert.equal(firstGridTrackWidth('280px minmax(0px, 1fr) 0px'), 280)
  assert.equal(firstGridTrackWidth('56.5px minmax(0, 1fr) 360px'), 56.5)
  assert.equal(firstGridTrackWidth('minmax(0, 1fr) 360px'), undefined)
})
