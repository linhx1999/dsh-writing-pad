/** Shared writing-pad state across the two registered slots (one instance per apply). */

export interface WritingPadEntry {
  open: boolean
  draft: string
  undoStack: readonly string[]
  status: 'idle' | 'saving' | 'saved' | 'error'
  notice: string
  mode: 'edit' | 'preview'
  selStart: number
  selEnd: number
  previewSel: string
  rewriteNote: string
}

export const defaultEntry = (): WritingPadEntry => ({
  open: false,
  draft: '',
  undoStack: [],
  status: 'idle',
  notice: '',
  mode: 'edit',
  selStart: 0,
  selEnd: 0,
  previewSel: '',
  rewriteNote: '',
})

export type DraftStatePatch = Partial<Omit<WritingPadEntry, 'draft' | 'undoStack'>>

export interface WritingPadStore {
  entryOf(sessionId: string): WritingPadEntry
  setEntry(sessionId: string, patch: Partial<WritingPadEntry>): void
  replaceDraft(sessionId: string, text: string, options?: {
    remember?: boolean
    patch?: DraftStatePatch
  }): void
  undoDraft(sessionId: string, patch?: DraftStatePatch): string | undefined
  subscribe(listener: () => void): () => void
}

const MAX_UNDO_STEPS = 50

export function createWritingPadStore(): WritingPadStore {
  const entries = new Map<string, WritingPadEntry>()
  const listeners = new Set<() => void>()
  const publish = (): void => {
    for (const fn of listeners) fn()
  }
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
      entries.set(sessionId, { ...this.entryOf(sessionId), ...patch })
      publish()
    },
    replaceDraft(sessionId, text, options = {}) {
      const current = this.entryOf(sessionId)
      const changed = text !== current.draft
      if (!changed && options.patch === undefined) return
      let undoStack = current.undoStack
      if (changed && options.remember === true && undoStack.at(-1) !== current.draft) {
        undoStack = [...undoStack, current.draft].slice(-MAX_UNDO_STEPS)
      }
      entries.set(sessionId, {
        ...current,
        ...options.patch,
        draft: text,
        undoStack,
      })
      publish()
    },
    undoDraft(sessionId, patch) {
      const current = this.entryOf(sessionId)
      const previous = current.undoStack.at(-1)
      if (previous === undefined) return undefined
      entries.set(sessionId, {
        ...current,
        ...patch,
        draft: previous,
        undoStack: current.undoStack.slice(0, -1),
      })
      publish()
      return previous
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
