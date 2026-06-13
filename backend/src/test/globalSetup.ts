import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { createClient } from '@libsql/client'

export async function setup() {
  // Start from a completely clean slate on every test run.
  for (const file of ['./test.db', './test.db-wal', './test.db-shm']) {
    if (existsSync(file)) unlinkSync(file)
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  })

  // Switch from WAL to DELETE journal mode so there are no WAL lock files
  // that can block the test worker's write transactions.
  const client = createClient({ url: 'file:./test.db' })
  await client.execute('PRAGMA journal_mode=DELETE')
  await client.execute('PRAGMA synchronous=FULL')
  client.close()
}
