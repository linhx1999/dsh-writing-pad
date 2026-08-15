/** Client Remote contribution and generated-style type declarations. */

import { z } from 'zod'
import type {
  InvocationDescriptor,
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol'

export interface SaveDraftResult {
  saved: boolean
}

export interface LoadDraftResult {
  text: string
  review: DraftReviewResult | null
}

export interface DraftReviewResult {
  id: string
  before: string
  after: string
}

export interface ResolveReviewResult {
  ok: boolean
  error: string
  text: string
}

const sessionIdSchema = z.string().min(1)
const textSchema = z.string()
const reviewSchema = z.object({ id: z.string(), before: z.string(), after: z.string() })
const saveDraftResultSchema = z.object({ saved: z.boolean() })
const loadDraftResultSchema = z.object({ text: z.string(), review: reviewSchema.nullable() })
const resolveReviewResultSchema = z.object({ ok: z.boolean(), error: z.string(), text: z.string() })

const agentParameter = {
  name: 'agent',
  wire: 'agentId',
  source: 'lookup',
  lookup: 'agent',
  codec: {
    mode: 'strict',
    typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    schema: sessionIdSchema,
  },
} as const

function stringParameter(name: string): InvocationDescriptor['parameters'][number] {
  return {
    name,
    wire: name,
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'typescript#string', schema: textSchema },
  }
}

function descriptor(
  method: string,
  parameters: InvocationDescriptor['parameters'],
  result: InvocationDescriptor['result'],
): InvocationDescriptor {
  return {
    id: `dsh-writing-pad#writingPad/${method}`,
    service: 'writingPad',
    namespace: 'writingPad',
    method,
    invocation: { kind: 'direct' },
    scope: { context: 'agent', wire: 'agentId' },
    parameters,
    result,
  }
}

export const descriptors: readonly InvocationDescriptor[] = [
  descriptor('saveDraft', [agentParameter, stringParameter('text')], {
    mode: 'strict', typeSymbol: 'dsh-writing-pad#SaveDraftResult', schema: saveDraftResultSchema,
  }),
  descriptor('loadDraft', [agentParameter], {
    mode: 'strict', typeSymbol: 'dsh-writing-pad#LoadDraftResult', schema: loadDraftResultSchema,
  }),
  descriptor('resolveReview', [
    agentParameter,
    stringParameter('reviewId'),
    {
      name: 'decision',
      wire: 'decision',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: 'dsh-writing-pad#ReviewDecision',
        schema: z.enum(['accept', 'reject']),
      },
    },
  ], {
    mode: 'strict', typeSymbol: 'dsh-writing-pad#ResolveReviewResult', schema: resolveReviewResultSchema,
  }),
]

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'writingPad/saveDraft': (agentId: string, text: string) => Promise<RemoteResult<SaveDraftResult>>
    'writingPad/loadDraft': (agentId: string) => Promise<RemoteResult<LoadDraftResult>>
    'writingPad/resolveReview': (
      agentId: string,
      reviewId: string,
      decision: 'accept' | 'reject',
    ) => Promise<RemoteResult<ResolveReviewResult>>
  }

  interface TypertRemoteNamespaceMap {
    writingPad: {
      saveDraft(agentId: string, text: string): Promise<RemoteResult<SaveDraftResult>>
      loadDraft(agentId: string): Promise<RemoteResult<LoadDraftResult>>
      resolveReview(
        agentId: string,
        reviewId: string,
        decision: 'accept' | 'reject',
      ): Promise<RemoteResult<ResolveReviewResult>>
    }
  }
}

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: 'dsh-writing-pad',
  descriptors,
}

export default TYPERT_REMOTE
