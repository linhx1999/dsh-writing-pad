/** Coupled height calculation for the bottom tools and instruction editor. */

export interface PanelHeights {
  tools: number
  note: number
}

export interface PanelHeightBounds {
  minTools: number
  maxTools: number
  minNote: number
  maxNote: number
}

export function resizePanelHeights(
  start: PanelHeights,
  requestedDelta: number,
  bounds: PanelHeightBounds,
): PanelHeights {
  const minDelta = Math.max(bounds.minTools - start.tools, bounds.minNote - start.note)
  const maxDelta = Math.min(bounds.maxTools - start.tools, bounds.maxNote - start.note)
  const delta = Math.max(minDelta, Math.min(maxDelta, Math.round(requestedDelta)))
  return {
    tools: start.tools + delta,
    note: start.note + delta,
  }
}
