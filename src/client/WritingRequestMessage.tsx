/** Transcript projection that keeps writing-pad XML model-visible but human-readable. */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import { ImageGallery } from '@deepseek-ai/dsh-client-ui-attachment'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconCheckOutline16,
  IconCopyOutline16,
  JsonBlock,
  MessageText,
  Tooltip,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  formatWritingRequestDisplay,
  parseWritingRequest,
  type WritingRequest,
} from '../draft-xml.ts'
import { NS } from './locales.ts'

type Props = ChatNodeViewProps<'user' | 'steering'> & {
  tPad: TranslateNS<typeof NS>
}
type ImageBlock = Extract<ContentBlock, { type: 'image' }>

function contentParts(content: readonly ContentBlock[]): {
  text: string
  images: ImageBlock[]
  rest: ContentBlock[]
} {
  const text: string[] = []
  const images: ImageBlock[] = []
  const rest: ContentBlock[] = []
  for (const block of content) {
    if (block.type === 'text') text.push(block.text)
    else if (block.type === 'image') images.push(block)
    else rest.push(block)
  }
  return { text: text.join(''), images, rest }
}

function RequestSummary({
  request,
  tPad,
}: {
  request: WritingRequest
  tPad: TranslateNS<typeof NS>
}) {
  const selection = request.selection?.text.trim()
  return (
    <div className="dsw-writing-message-request" data-writing-request={request.operation}>
      {selection !== undefined && selection !== '' && (
        <section className="dsw-writing-message-section">
          <span className="dsw-writing-message-label">{tPad('message.selectionLabel')}</span>
          <span className="dsw-writing-message-selection">{selection}</span>
        </section>
      )}
      <section className="dsw-writing-message-section">
        <span className="dsw-writing-message-label">{tPad('message.instructionLabel')}</span>
        <span className="dsw-writing-message-instruction">{request.instruction}</span>
      </section>
    </div>
  )
}

function UserText({ text }: { text: string }) {
  const reference = /(^|\s)([/@][\w-]+)(?=\s|$)/g
  const parts: React.ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = reference.exec(text)) !== null) {
    const start = match.index + (match[1]?.length ?? 0)
    const label = match[2] ?? ''
    if (start > cursor) parts.push(<MessageText key={cursor} text={text.slice(cursor, start)} />)
    parts.push(
      <span
        key={start}
        className="dsw-writing-message-reference"
        data-ref-chip={label.startsWith('@') ? 'subagent' : 'skill'}
      >
        {label}
      </span>,
    )
    cursor = start + label.length
  }
  if (parts.length === 0) return <MessageText text={text} />
  if (cursor < text.length) parts.push(<MessageText key={cursor} text={text.slice(cursor)} />)
  return <>{parts}</>
}

function formatClock(time: number): string {
  const value = new Date(time)
  const today = new Date()
  const clock = value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (value.toDateString() === today.toDateString()) return clock
  return `${value.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} ${clock}`
}

/** Shadows only the presentation of user rows; their durable content is untouched. */
export function WritingRequestMessage({ node, loadImage, t, tPad }: Props) {
  const { text, images, rest } = contentParts(node.data.content)
  const request = useMemo(() => parseWritingRequest(text), [text])
  const visibleText = request === null
    ? text
    : formatWritingRequestDisplay(request, {
        selection: tPad('message.selectionLabel'),
        instruction: tPad('message.instructionLabel'),
      })
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copyTimer.current !== null) clearTimeout(copyTimer.current)
  }, [])

  const copy = async (): Promise<void> => {
    if (copied) return
    if (!await writeClipboard(visibleText)) return
    setCopied(true)
    if (copyTimer.current !== null) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => {
      copyTimer.current = null
      setCopied(false)
    }, 1000)
  }

  return (
    <div className="dsw-writing-message-row" data-time-hover-root>
      <div className="dsw-writing-message-stack">
        <ImageGallery
          images={images}
          load={loadImage}
          align="end"
          labels={{
            image: t('image.label'),
            open: t('image.openOriginal'),
            openNamed: label => t('image.openOriginalLabel', { label }),
            loading: t('image.loading'),
            loadFailed: t('image.loadFailed'),
            lightbox: { dialog: t('image.preview'), close: t('image.closePreview') },
          }}
        />
        {(visibleText !== '' || rest.length > 0) && (
          <div className="dsw-writing-message-bubble">
            {request === null ? <UserText text={text} /> : <RequestSummary request={request} tPad={tPad} />}
            {rest.map((block, index) => (
              <JsonBlock key={index} label={t('message.extraBlock')} payload={block} />
            ))}
          </div>
        )}
      </div>
      <div className="dsw-writing-message-actions">
        <span className="dsw-writing-message-time">{formatClock(node.data.time)}</span>
        <Tooltip label={copied ? tPad('message.copied') : tPad('message.copy')} side="bottom">
          <button
            type="button"
            className="dsw-writing-message-action"
            aria-label={copied ? tPad('message.copied') : tPad('message.copy')}
            onClick={() => void copy()}
          >
            {copied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
