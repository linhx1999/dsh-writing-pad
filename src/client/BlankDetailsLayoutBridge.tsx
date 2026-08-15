/** Makes ui-layout's real details grid track visible for an open blank session. */

import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  blankDetailsWidth,
  currentBlankSessionId,
  firstGridTrackWidth,
} from './blank-session.ts'
import type { WritingPadStore } from './store.ts'

export type BlankDetailsLayoutBridgeProps = PropsRuntime<'shell.overlay'> & {
  store: WritingPadStore
}

const FRAME_ATTRIBUTE = 'data-dsw-writing-pad-blank-details'
const SIDEBAR_WIDTH_PROPERTY = '--dsw-writing-pad-sidebar-width'
const DETAILS_WIDTH_PROPERTY = '--dsw-writing-pad-details-width'

export function BlankDetailsLayoutBridge(props: BlankDetailsLayoutBridgeProps) {
  const markerRef = useRef<HTMLSpanElement>(null)
  const blankSessionId = props.useSessions(currentBlankSessionId)
  const open = useSyncExternalStore(
    props.store.subscribe,
    () => blankSessionId !== undefined && props.store.entryOf(blankSessionId).open,
  )

  useLayoutEffect(() => {
    if (!open) return
    const overlay = markerRef.current?.closest<HTMLElement>('[data-shell-overlay]')
    const frame = overlay?.parentElement
    if (frame === undefined || frame === null) return

    let animationFrame: number | undefined
    const syncColumns = (): void => {
      animationFrame = undefined
      const template = frame.style.gridTemplateColumns
      const measuredSidebar = frame.firstElementChild?.getBoundingClientRect().width ?? 0
      const sidebar = firstGridTrackWidth(template) ?? measuredSidebar
      const viewport = frame.getBoundingClientRect().width
      const details = blankDetailsWidth(viewport, sidebar)
      const sidebarValue = `${sidebar}px`
      const detailsValue = `${details}px`

      frame.setAttribute(FRAME_ATTRIBUTE, '')
      if (frame.style.getPropertyValue(SIDEBAR_WIDTH_PROPERTY) !== sidebarValue) {
        frame.style.setProperty(SIDEBAR_WIDTH_PROPERTY, sidebarValue)
      }
      if (frame.style.getPropertyValue(DETAILS_WIDTH_PROPERTY) !== detailsValue) {
        frame.style.setProperty(DETAILS_WIDTH_PROPERTY, detailsValue)
      }
    }
    const scheduleSync = (): void => {
      if (animationFrame !== undefined) return
      animationFrame = requestAnimationFrame(syncColumns)
    }

    syncColumns()
    const resizeObserver = new ResizeObserver(scheduleSync)
    resizeObserver.observe(frame)
    const mutationObserver = new MutationObserver(scheduleSync)
    mutationObserver.observe(frame, {
      attributes: true,
      attributeFilter: ['style', 'data-sidebar-collapsed'],
    })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
      frame.removeAttribute(FRAME_ATTRIBUTE)
      frame.style.removeProperty(SIDEBAR_WIDTH_PROPERTY)
      frame.style.removeProperty(DETAILS_WIDTH_PROPERTY)
    }
  }, [open])

  return open
    ? <span ref={markerRef} className="dsw-writing-pad-layout-bridge" aria-hidden="true" />
    : null
}
