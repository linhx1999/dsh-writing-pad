/** Versioned XML envelopes shared by the Host snapshot store and web client. */

import { REWRITE_SELECTED_TEXT_TOOL, WRITE_FULL_DRAFT_TOOL } from './writing-tools.ts'

const CDATA_END = ']]>'
const CDATA_SPLIT = ']]]]><![CDATA[>'
const SNAPSHOT_PATTERN = /<dsh-writing-pad version="1">\s*<draft><!\[CDATA\[([\s\S]*?)\]\]><\/draft>\s*<\/dsh-writing-pad>/
const REQUEST_PATTERN = /^\s*<dsh-writing-pad-request\s+version="1"\s+operation="(write|rewrite)">([\s\S]*?)<\/dsh-writing-pad-request>\s*$/
const DRAFT_PATTERN = /<draft><!\[CDATA\[([\s\S]*?)\]\]><\/draft>/
const INSTRUCTION_PATTERN = /<instruction><!\[CDATA\[([\s\S]*?)\]\]><\/instruction>/
const SELECTION_PATTERN = /<selection\s+mode="(edit|preview)"(?:\s+start="(\d+)"\s+end="(\d+)")?><!\[CDATA\[([\s\S]*?)\]\]><\/selection>/

export type WritingRequestMode = 'edit' | 'preview'

export interface WritingSelection {
  mode: WritingRequestMode
  text: string
  start?: number
  end?: number
}

export interface WritingRequest {
  operation: 'write' | 'rewrite'
  draft: string
  instruction: string
  selection?: WritingSelection
}

function cdata(text: string): string {
  return `<![CDATA[${text.replaceAll(CDATA_END, CDATA_SPLIT)}]]>`
}

function readCdata(text: string): string {
  return text.replaceAll(CDATA_SPLIT, CDATA_END)
}

/** Serialize one complete draft snapshot without changing its Markdown bytes. */
export function serializeDraftSnapshot(draft: string): string {
  return [
    '<dsh-writing-pad version="1">',
    `  <draft>${cdata(draft)}</draft>`,
    '</dsh-writing-pad>',
  ].join('\n')
}

/** Parse a supported snapshot envelope; unrelated or malformed XML is ignored. */
export function parseDraftSnapshot(text: string): string | null {
  const match = SNAPSHOT_PATTERN.exec(text)
  return match === null ? null : readCdata(match[1]!)
}

/** Read the complete draft carried by one real writing-pad user request. */
export function parseWritingRequestDraft(text: string): string | null {
  return parseWritingRequest(text)?.draft ?? null
}

/** Parse a supported request envelope for durable recovery and UI projection. */
export function parseWritingRequest(text: string): WritingRequest | null {
  const request = REQUEST_PATTERN.exec(text)
  if (request === null) return null
  const body = request[2]!
  const draft = DRAFT_PATTERN.exec(body)
  const instruction = INSTRUCTION_PATTERN.exec(body)
  if (draft === null || instruction === null) return null

  const rawSelection = SELECTION_PATTERN.exec(body)
  if (rawSelection === null && body.includes('<selection')) return null
  let selection: WritingSelection | undefined
  if (rawSelection !== null) {
    const start = rawSelection[2] === undefined ? undefined : Number(rawSelection[2])
    const end = rawSelection[3] === undefined ? undefined : Number(rawSelection[3])
    selection = {
      mode: rawSelection[1] as WritingRequestMode,
      text: readCdata(rawSelection[4]!),
      ...(start === undefined || end === undefined ? {} : { start, end }),
    }
  }

  return {
    operation: request[1] as WritingRequest['operation'],
    draft: readCdata(draft[1]!),
    instruction: readCdata(instruction[1]!),
    ...(selection === undefined ? {} : { selection }),
  }
}

/** Plain-text transcript/copy projection that deliberately excludes the draft. */
export function formatWritingRequestDisplay(request: WritingRequest): string {
  const selection = request.selection?.text.trim()
  return [
    selection === undefined || selection === '' ? '' : `修改内容\n${selection}`,
    `额外要求\n${request.instruction}`,
  ].filter(Boolean).join('\n\n')
}

/** Serialize the single user request that tells the model where its result belongs. */
export function serializeWritingRequest(request: WritingRequest): string {
  const destination = request.operation === 'write' ? WRITE_FULL_DRAFT_TOOL : REWRITE_SELECTED_TEXT_TOOL
  const lines = [
    `<dsh-writing-pad-request version="1" operation="${request.operation}">`,
    `  <draft>${cdata(request.draft)}</draft>`,
    `  <instruction>${cdata(request.instruction)}</instruction>`,
  ]
  const selection = request.selection
  if (selection !== undefined) {
    const offsets = selection.start === undefined || selection.end === undefined
      ? ''
      : ` start="${selection.start}" end="${selection.end}"`
    lines.push(`  <selection mode="${selection.mode}"${offsets}>${cdata(selection.text)}</selection>`)
  }
  lines.push(
    `  <destination tool="${destination}" required="true" />`,
    '</dsh-writing-pad-request>',
  )
  return lines.join('\n')
}
