import { testDatabaseUrl } from './test-database';

// Runs in every test worker before any module is loaded, so PrismaService and
// Config read the test values. DATABASE_URL is always overridden, even when a
// .env file or the shell sets it, so the dev database can't be reached.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET ??= 'integration_test_secret_key';
process.env.SUPERADMIN_EMAIL ??= 'admin@example.com';
process.env.SUPERADMIN_PASSWORD ??= 'adminpassword';
process.env.BACKEND_URL ??= 'http://localhost:4050';
process.env.FRONTEND_URL ??= 'http://localhost:3050';
// Emails go to the console adapter, never to a real provider.
process.env.RESEND_API_KEY = '';
process.env.SMTP_HOST = '';
