import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  dts: false,
  shims: true,
  esbuildOptions(options) {
    options.external = ['node:sqlite', 'sqlite', ...(options.external || [])]
  },
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`
  }
})
