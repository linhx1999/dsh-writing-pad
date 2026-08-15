import assert from 'node:assert/strict'
import test from 'node:test'
import { resizePanelHeights } from '../src/client/panel-resize.ts'

const bounds = {
  minTools: 160,
  maxTools: 420,
  minNote: 54,
  maxNote: 314,
}

test('panel resize moves both top edges together while preserving their offset', () => {
  const start = { tools: 160, note: 54 }
  const resized = resizePanelHeights(start, 80, bounds)

  assert.deepEqual(resized, { tools: 240, note: 134 })
  assert.equal(resized.tools - resized.note, start.tools - start.note)
})

test('panel resize clamps both heights with the same delta', () => {
  assert.deepEqual(
    resizePanelHeights({ tools: 400, note: 294 }, 50, bounds),
    { tools: 420, note: 314 },
  )
  assert.deepEqual(
    resizePanelHeights({ tools: 220, note: 114 }, -80, bounds),
    { tools: 160, note: 54 },
  )
})
