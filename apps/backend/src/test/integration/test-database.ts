// Integration tests wipe every table between tests, so they must never reach
// the dev database. Locally they use `quacker_test` in the same Docker
// Postgres as the dev database; CI points TEST_DATABASE_URL at its own service.
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://quacker:quacker@localhost:5433/quacker_test';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const databaseName = new URL(url).pathname.replace(/^\//, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${databaseName}": the database name must end with "_test".`,
    );
  }
  return url;
}
