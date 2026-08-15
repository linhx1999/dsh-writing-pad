/** Pure selection of the current blank session for the pre-first-message panel. */

export interface BlankSessionIndex<SessionId extends string = string> {
  readonly current: SessionId | undefined
  readonly byId: Readonly<Partial<Record<SessionId, { readonly blank: boolean }>>>
}

export function currentBlankSessionId<SessionId extends string>(
  state: BlankSessionIndex<SessionId>,
): SessionId | undefined {
  const current = state.current
  return current !== undefined && state.byId[current]?.blank === true ? current : undefined
}

const MIN_CENTER_WIDTH = 640
const MIN_DETAILS_WIDTH = 300
const DEFAULT_DETAILS_WIDTH = 360

/** Match ui-layout's details concession while it suppresses blank-session width. */
export function blankDetailsWidth(viewport: number, sidebar: number): number {
  const available = Math.round(viewport) - Math.round(sidebar) - MIN_CENTER_WIDTH
  if (available < MIN_DETAILS_WIDTH) return 0
  return Math.min(DEFAULT_DETAILS_WIDTH, available)
}

/** Read ui-layout's intended first grid track from its inline template. */
export function firstGridTrackWidth(template: string): number | undefined {
  const match = /^\s*(\d+(?:\.\d+)?)px(?:\s|$)/u.exec(template)
  if (match === null) return undefined
  const width = Number(match[1])
  return Number.isFinite(width) ? width : undefined
}
