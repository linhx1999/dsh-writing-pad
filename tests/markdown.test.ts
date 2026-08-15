import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdownDiff } from '../src/client/markdown.ts'

test('diff renderer highlights focused replacement blocks', () => {
  const html = renderMarkdownDiff('# 标题\n\n旧段落', '# 标题\n\n新段落')
  assert.match(html, /dsw-writing-pad-diff-delete/)
  assert.match(html, /旧段落/)
  assert.match(html, /dsw-writing-pad-diff-add/)
  assert.match(html, /新段落/)
})

test('diff renderer escapes untrusted HTML in both versions', () => {
  const html = renderMarkdownDiff('<script>old()</script>', '<img onerror="new()">')
  assert.doesNotMatch(html, /<script>|<img onerror/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img onerror=&quot;new\(\)&quot;&gt;/)
})
