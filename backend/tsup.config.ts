import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: [
    // Native modules that can't be bundled
    '@prisma/client',
    '@prisma/adapter-libsql',
    '@libsql/client',
  ],
})
