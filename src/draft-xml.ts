/** Versioned XML envelopes shared by the Host snapshot store and web client. */

import { REWRITE_SELECTED_TEXT_TOOL, WRITE_FULL_DRAFT_TOOL } from './writing-tools.ts'

const CDATA_END = ']]>'
const CDATA_SPLIT = ']]]]><![CDATA[>'
const CONTEXT_OPEN = '<dsh-writing-pad-context version="1">'
const CONTEXT_CLOSE = '</dsh-writing-pad-context>'
const SNAPSHOT_PATTERN = /<dsh-writing-pad version="1">\s*<draft>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/draft>\s*<\/dsh-writing-pad>/
const REQUEST_PATTERN = /^\s*<dsh-writing-pad-request\s+version="1"\s+operation="(write|rewrite)">([\s\S]*?)<\/dsh-writing-pad-request>\s*$/
const CONTEXT_PATTERN = /^<dsh-writing-pad-context\s+version="1">([\s\S]*?)<\/dsh-writing-pad-context>(?:\n\n([\s\S]*))?$/
const DRAFT_PATTERN = /<draft>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/draft>/
const INSTRUCTION_PATTERN = /<instruction>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/instruction>/
const SELECTION_PATTERN = /<selection\s+mode="(edit|preview)"(?:\s+start="(\d+)"\s+end="(\d+)")?>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/selection>/

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

export interface WritingRequestDisplayLabels {
  selection: string
  instruction: string
}

export interface DraftContextMessage {
  draft: string
  message: string
}

const DEFAULT_DISPLAY_LABELS: WritingRequestDisplayLabels = {
  selection: '修改内容',
  instruction: '额外要求',
}

function cdata(text: string): string {
  return `<![CDATA[${text.replaceAll(CDATA_END, CDATA_SPLIT)}]]>`
}

function readCdata(text: string): string {
  return text.replaceAll(CDATA_SPLIT, CDATA_END)
}

function cdataElement(name: string, text: string, attributes = ''): string[] {
  return [
    `  <${name}${attributes}>`,
    `    ${cdata(text)}`,
    `  </${name}>`,
  ]
}

/** Serialize one complete draft snapshot without changing its Markdown bytes. */
export function serializeDraftSnapshot(draft: string): string {
  return [
    '<dsh-writing-pad version="1">',
    ...cdataElement('draft', draft),
    '</dsh-writing-pad>',
  ].join('\n')
}

/** Parse a supported snapshot envelope; unrelated or malformed XML is ignored. */
export function parseDraftSnapshot(text: string): string | null {
  const match = SNAPSHOT_PATTERN.exec(text)
  return match === null ? null : readCdata(match[1]!)
}

/** Serialize a draft context followed by the user's unchanged conversation message. */
export function serializeDraftContextMessage(draft: string, message: string): string {
  const context = [
    '<dsh-writing-pad-context version="1">',
    ...cdataElement('draft', draft),
    '</dsh-writing-pad-context>',
  ].join('\n')
  return message === '' ? context : `${context}\n\n${message}`
}

/** Parse a draft context without reclassifying the trailing conversation message. */
export function parseDraftContextMessage(text: string): DraftContextMessage | null {
  const context = CONTEXT_PATTERN.exec(text)
  if (context === null) return null
  const draft = DRAFT_PATTERN.exec(context[1]!)
  if (draft === null) return null
  return { draft: readCdata(draft[1]!), message: context[2] ?? '' }
}

/** Hide a leading draft-context envelope without depending on its internal fields. */
export function projectDraftContextMessage(text: string): string | null {
  if (!text.startsWith(CONTEXT_OPEN)) return null
  let cursor = CONTEXT_OPEN.length
  while (cursor < text.length) {
    const close = text.indexOf(CONTEXT_CLOSE, cursor)
    if (close === -1) return null
    const suffix = text.slice(close + CONTEXT_CLOSE.length)
    if (suffix === '') return ''
    if (suffix.startsWith('\n\n')) return suffix.slice(2)
    if (suffix.startsWith('\r\n\r\n')) return suffix.slice(4)
    cursor = close + CONTEXT_CLOSE.length
  }
  return null
}

/** Read the complete draft carried by either supported real user-message envelope. */
export function parseWritingPadMessageDraft(text: string): string | null {
  return parseWritingRequest(text)?.draft ?? parseDraftContextMessage(text)?.draft ?? null
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
export function formatWritingRequestDisplay(
  request: WritingRequest,
  labels: WritingRequestDisplayLabels = DEFAULT_DISPLAY_LABELS,
): string {
  const selection = request.selection?.text.trim()
  return [
    selection === undefined || selection === '' ? '' : `${labels.selection}\n${selection}`,
    `${labels.instruction}\n${request.instruction}`,
  ].filter(Boolean).join('\n\n')
}

/** Serialize the single user request that tells the model where its result belongs. */
export function serializeWritingRequest(request: WritingRequest): string {
  const destination = request.operation === 'write' ? WRITE_FULL_DRAFT_TOOL : REWRITE_SELECTED_TEXT_TOOL
  const lines = [
    `<dsh-writing-pad-request version="1" operation="${request.operation}">`,
    ...cdataElement('draft', request.draft),
    ...cdataElement('instruction', request.instruction),
  ]
  const selection = request.selection
  if (selection !== undefined) {
    const offsets = selection.start === undefined || selection.end === undefined
      ? ''
      : ` start="${selection.start}" end="${selection.end}"`
    lines.push(...cdataElement('selection', selection.text, ` mode="${selection.mode}"${offsets}`))
  }
  lines.push(
    `  <destination tool="${destination}" required="true" />`,
    '</dsh-writing-pad-request>',
  )
  return lines.join('\n')
}
