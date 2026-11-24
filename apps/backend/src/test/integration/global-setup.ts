import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { testDatabaseUrl } from './test-database';

/**
 * Runs once before all integration tests: brings the test database to the
 * schema in our Prisma migrations (creating the database if it doesn't exist).
 */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
