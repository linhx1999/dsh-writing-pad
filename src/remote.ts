/**
 * Generated Remote client binding for WritingPadService.
 *
 * The typert generator derives `ctx.remote.writingPad` method stubs from the
 * @Remote methods on WritingPadService plus a wire-level invoke path (see the
 * README "Client→Host bridge" section). Until the generator runs, the client
 * half casts `ctx.remote.writingPad` to this interface; keep the two in sync.
 */
export interface WritingPadRemote {
  saveDraft(sessionId: string, text: string): Promise<{ saved: boolean }>
  loadDraft(sessionId: string): Promise<{ text: string }>
  saveFile(
    sessionId: string,
    name: string,
    text: string,
  ): Promise<{ ok: boolean; error?: string; path?: string }>
  loadFile(
    sessionId: string,
    name: string,
  ): Promise<{ ok: boolean; error?: string; path?: string; text?: string }>
}
