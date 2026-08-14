/** Shared writing-pad state across the two registered slots (one instance per apply). */

export interface WritingPadEntry {
  open: boolean
  draft: string
  status: 'idle' | 'saving' | 'saved' | 'error'
  fileName: string
  fileStatus: string
  mode: 'edit' | 'preview'
  selStart: number
  selEnd: number
  previewSel: string
  rewriteNote: string
}

export const defaultEntry = (): WritingPadEntry => ({
  open: false,
  draft: '',
  status: 'idle',
  fileName: 'draft.md',
  fileStatus: '',
  mode: 'edit',
  selStart: 0,
  selEnd: 0,
  previewSel: '',
  rewriteNote: '',
})

export interface WritingPadStore {
  entryOf(sessionId: string): WritingPadEntry
  setEntry(sessionId: string, patch: Partial<WritingPadEntry>): void
  subscribe(listener: () => void): () => void
}

export function createWritingPadStore(): WritingPadStore {
  const entries = new Map<string, WritingPadEntry>()
  const listeners = new Set<() => void>()
  return {
    entryOf(sessionId) {
      let entry = entries.get(sessionId)
      if (entry === undefined) {
        entry = defaultEntry()
        entries.set(sessionId, entry)
      }
      return entry
    },
    setEntry(sessionId, patch) {
      Object.assign(this.entryOf(sessionId), patch)
      for (const fn of listeners) fn()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
