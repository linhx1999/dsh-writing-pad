import { defineConfig } from 'tsdown'

// Self-contained build for the published package: no project references, no
// type checking, plain transpile to ESM. Runs from `prepare` after a git
// install, so it must not assume any monorepo context.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client/index.tsx',
  },
  format: ['esm'],
  target: 'es2022',
  sourcemap: true,
  clean: true,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-agent',
    '@deepseek-ai/dsh-tools',
    '@deepseek-ai/dsh-typert-protocol',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-api-remotes',
    'react',
  ],
})
