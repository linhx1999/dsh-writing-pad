import assert from 'node:assert/strict'
import test from 'node:test'
import { resizePanelHeights } from '../src/client/panel-resize.ts'

const bounds = {
  minTools: 164,
  maxTools: 420,
  minNote: 54,
  maxNote: 310,
}

test('panel resize moves both top edges together while preserving their offset', () => {
  const start = { tools: 164, note: 54 }
  const resized = resizePanelHeights(start, 80, bounds)

  assert.deepEqual(resized, { tools: 244, note: 134 })
  assert.equal(resized.tools - resized.note, start.tools - start.note)
})

test('panel resize clamps both heights with the same delta', () => {
  assert.deepEqual(
    resizePanelHeights({ tools: 400, note: 290 }, 50, bounds),
    { tools: 420, note: 310 },
  )
  assert.deepEqual(
    resizePanelHeights({ tools: 220, note: 110 }, -80, bounds),
    { tools: 164, note: 54 },
  )
})
