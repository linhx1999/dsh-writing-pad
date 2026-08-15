import assert from 'node:assert/strict'
import test from 'node:test'
import { resizePanelHeights } from '../src/client/panel-resize.ts'

const bounds = {
  minTools: 190,
  maxTools: 420,
  minNote: 54,
  maxNote: 284,
}

test('panel resize moves both top edges together while preserving their offset', () => {
  const start = { tools: 190, note: 54 }
  const resized = resizePanelHeights(start, 80, bounds)

  assert.deepEqual(resized, { tools: 270, note: 134 })
  assert.equal(resized.tools - resized.note, start.tools - start.note)
})

test('panel resize clamps both heights with the same delta', () => {
  assert.deepEqual(
    resizePanelHeights({ tools: 400, note: 264 }, 50, bounds),
    { tools: 420, note: 284 },
  )
  assert.deepEqual(
    resizePanelHeights({ tools: 220, note: 84 }, -50, bounds),
    { tools: 190, note: 54 },
  )
})
