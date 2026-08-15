export type ReviewDecision = 'accept' | 'reject'

export interface StoredReviewDecision {
  reviewId: string
  decision: ReviewDecision
}

const DEFAULT_NOTE_KEY = 'dsh-writing-pad.default-rewrite-note.v1'
const REVIEW_DECISIONS_KEY = 'dsh-writing-pad.review-decisions.v1'

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function loadDefaultRewriteNote(storage: Storage | null = browserStorage()): string {
  try {
    return storage?.getItem(DEFAULT_NOTE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDefaultRewriteNote(
  text: string,
  storage: Storage | null = browserStorage(),
): boolean {
  if (storage === null) return false
  try {
    if (text === '') storage.removeItem(DEFAULT_NOTE_KEY)
    else storage.setItem(DEFAULT_NOTE_KEY, text)
    return true
  } catch {
    return false
  }
}

function reviewDecisions(storage: Storage): Record<string, StoredReviewDecision> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REVIEW_DECISIONS_KEY) ?? '{}')
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const decisions: Record<string, StoredReviewDecision> = {}
    for (const [sessionId, value] of Object.entries(parsed)) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) continue
      const record = value as Record<string, unknown>
      if (typeof record.reviewId !== 'string') continue
      if (record.decision !== 'accept' && record.decision !== 'reject') continue
      decisions[sessionId] = { reviewId: record.reviewId, decision: record.decision }
    }
    return decisions
  } catch {
    return {}
  }
}

export function loadReviewDecision(
  sessionId: string,
  storage: Storage | null = browserStorage(),
): StoredReviewDecision | null {
  if (storage === null) return null
  return reviewDecisions(storage)[sessionId] ?? null
}

export function saveReviewDecision(
  sessionId: string,
  value: StoredReviewDecision,
  storage: Storage | null = browserStorage(),
): boolean {
  if (storage === null) return false
  try {
    const decisions = reviewDecisions(storage)
    decisions[sessionId] = value
    storage.setItem(REVIEW_DECISIONS_KEY, JSON.stringify(decisions))
    return true
  } catch {
    return false
  }
}

export function clearReviewDecision(
  sessionId: string,
  storage: Storage | null = browserStorage(),
): boolean {
  if (storage === null) return false
  try {
    const decisions = reviewDecisions(storage)
    delete decisions[sessionId]
    if (Object.keys(decisions).length === 0) storage.removeItem(REVIEW_DECISIONS_KEY)
    else storage.setItem(REVIEW_DECISIONS_KEY, JSON.stringify(decisions))
    return true
  } catch {
    return false
  }
}
