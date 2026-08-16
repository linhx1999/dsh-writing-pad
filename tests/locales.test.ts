import assert from 'node:assert/strict'
import test from 'node:test'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import {
  en,
  formatFeedback,
  NS,
  resolveRewriteInstruction,
  zh,
} from '../src/client/locales.ts'

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)]
    .map(match => match[1]!)
    .sort()
}

function localeBench(): {
  t: TranslateNS<typeof NS>
  setLocale(locale: 'zh' | 'en'): void
} {
  let active: 'zh' | 'en' = 'zh'
  return {
    t(key, params) {
      const template = (active === 'zh' ? zh : en)[key]
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (
        name in params ? String(params[name]) : match
      ))
    },
    setLocale(locale) { active = locale },
  }
}

test('writing-pad dictionaries are complete and keep template parameters aligned', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
    assert.notEqual(zh[key].trim(), '', `${key} has an empty zh value`)
    assert.notEqual(en[key].trim(), '', `${key} has an empty en value`)
    assert.deepEqual(
      placeholders(en[key]),
      placeholders(zh[key]),
      `${key} has mismatched template parameters`,
    )
  }
})

test('the bound writing-pad translator switches text and interpolates parameters', () => {
  const locale = localeBench()
  const { t } = locale

  assert.equal(t('title.pad'), '写作板')
  assert.equal(t('hint.selected', { text: '原文' }), '已选中：原文')
  assert.equal(t('note.defaultInstruction'), zh['note.defaultInstruction'])
  assert.equal(resolveRewriteInstruction('  ', t), zh['note.defaultInstruction'])
  assert.equal(resolveRewriteInstruction('  用户保存的要求  ', t), '用户保存的要求')

  locale.setLocale('en')
  assert.equal(t('title.pad'), 'Writing Pad')
  assert.equal(t('hint.selected', { text: 'source' }), 'Selected: source')
  assert.equal(t('note.defaultInstruction'), en['note.defaultInstruction'])
  assert.equal(resolveRewriteInstruction('', t), en['note.defaultInstruction'])
  assert.equal(resolveRewriteInstruction('User default', t), 'User default')
})

test('semantic feedback re-renders in the active language without translating raw errors', () => {
  const locale = localeBench()
  const { t } = locale
  const ready = { key: 'feedback.reviewReady' } as const
  const unknown = { key: 'feedback.saveFailed' } as const
  const raw = { key: 'feedback.rawError', message: 'Host error text' } as const

  assert.equal(formatFeedback(t, ready), 'AI 已生成，请审核修改')
  assert.equal(formatFeedback(t, unknown), '暂存失败：未知错误')
  assert.equal(formatFeedback(t, raw), 'Host error text')

  locale.setLocale('en')
  assert.equal(formatFeedback(t, ready), 'AI changes are ready for review')
  assert.equal(formatFeedback(t, unknown), 'Save failed: Unknown error')
  assert.equal(formatFeedback(t, raw), 'Host error text')
})
