/** Finds writing-tool activity in the recursive conversation call tree. */

import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import {
  REWRITE_SELECTED_TEXT_TOOL,
  WRITE_FULL_DRAFT_TOOL,
} from '../writing-tools.ts'

const WRITING_TOOL_NAMES = new Set([
  WRITE_FULL_DRAFT_TOOL,
  REWRITE_SELECTED_TEXT_TOOL,
])

const toolName = (block: ToolCallBlock): string | undefined =>
  'kind' in block ? block.call?.name : block.name

/**
 * Returns the latest writing-tool call id in start order, including Code Mode children.
 *
 * @param blocks - Running root calls and their recursively owned child calls.
 * @returns The latest matching call id, or undefined when no writing tool is active.
 */
export function latestWritingToolCallId(
  blocks: readonly ToolCallBlock[],
): string | undefined {
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index]
    if (block === undefined) continue
    const child = latestWritingToolCallId(block.subCalls)
    if (child !== undefined) return child
    const name = toolName(block)
    if (name !== undefined && WRITING_TOOL_NAMES.has(name)) return block.callId
  }
  return undefined
}
