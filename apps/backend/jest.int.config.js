// Integration tests: real HTTP requests (supertest) to the whole Nest app,
// against a real Postgres database (see src/test/integration/test-database.ts).
// Unit tests (`*.spec.ts`) use the config in package.json.
module.exports = {
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts', 'tsx'],
  rootDir: './',
  testRegex: '\\.int-spec\\.ts$',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    // The app loads BetterAuth, which (with its dependencies) ships only ES
    // modules. Jest runs CommonJS, so dependencies are transpiled too. That
    // makes the first run slow; later runs reuse the cache below (CI caches it).
    '^.+\\.m?js$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { allowJs: true, module: 'commonjs', target: 'es2022' },
      },
    ],
  },
  transformIgnorePatterns: [],
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-int',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/core/email/render$': '<rootDir>/src/test/integration/render-email.stub.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/src/test/integration/global-setup.ts',
  setupFiles: ['<rootDir>/src/test/integration/setup-env.ts'],
};
