import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { defineConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-writing-pad'
const CSS_VIRTUAL_PREFIX = '\0dsh-writing-pad-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

const sharedExternals = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-typert-protocol',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-slots',
  'react',
  'react/jsx-runtime',
]

// Self-contained published build: Host ESM plus the browser's registered CJS
// closure bundle. It runs from `prepare` after a git install, so it must not
// assume project references or a sibling Harness checkout.
export default defineConfig([
  {
    name: `${PACKAGE_NAME}/host`,
    entry: {
      index: 'src/index.ts',
      remote: 'src/remote.ts',
      typert: 'src/typert.ts',
    },
    outDir: 'dist',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    fixedExtension: false,
    dts: true,
    sourcemap: true,
    clean: true,
    deps: { neverBundle: sharedExternals },
  },
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'dist',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
    // zod backs the generated-style Remote boundary codecs and is not a web
    // platform module, so it must travel inside this closure bundle.
    deps: {
      neverBundle: [
        '@deepseek-ai/dsh-client-ui-attachment',
        '@deepseek-ai/dsh-client-ui-primitives',
        'react',
        'react/jsx-runtime',
      ],
      alwaysBundle: ['zod'],
    },
    plugins: [{
      name: 'dsh-writing-pad-css-inline',
      resolveId(source, importer) {
        if (!source.endsWith('.css') || importer === undefined) return null
        return CSS_VIRTUAL_PREFIX + resolve(dirname(importer), source) + CSS_VIRTUAL_SUFFIX
      },
      async load(id) {
        if (!id.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const path = id.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(path)
        const css = await readFile(path, 'utf8')
        const tagId = `${PACKAGE_NAME}/${basename(path)}`
        return [
          `const css = ${JSON.stringify(css)};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
          "  const tag = document.createElement('style');",
          `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
          '  tag.dataset.pluginCss = tagId;',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
        ].join('\n')
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
  {
    name: `${PACKAGE_NAME}/client-types`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'dist',
    format: ['esm'],
    platform: 'neutral',
    target: 'es2022',
    fixedExtension: false,
    dts: { emitDtsOnly: true },
    sourcemap: false,
    clean: false,
    deps: { neverBundle: true },
  },
])
