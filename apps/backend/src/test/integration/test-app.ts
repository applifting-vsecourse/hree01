import { AppModule } from '@/app.module';
import { configureApp } from '@/configure-app';
import { PrismaService } from '@/core/prisma/prisma.service';
import { Config } from '@/shared/config/config.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

/** The whole Nest app, wired like `main.ts`, without listening on a port. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  return app;
}

/** Empties every table except Prisma's migration history. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

type TestUser = { email: string; password: string; name: string };

let userCounter = 0;

/**
 * Signs a fresh user up through BetterAuth's real HTTP endpoint and returns an
 * agent that sends that user's session cookie with every request.
 */
export async function signedInAgent(
  app: INestApplication,
  overrides: Partial<TestUser> = {},
): Promise<{ agent: request.Agent; user: TestUser }> {
  userCounter += 1;
  const user: TestUser = {
    email: `user${userCounter}@example.com`,
    password: 'password123',
    name: `Test User ${userCounter}`,
    ...overrides,
  };
  const agent = request.agent(app.getHttpServer());
  // BetterAuth checks the Origin of cookie-carrying requests against its
  // trusted origins, so send the frontend's origin like a browser would.
  agent.set('Origin', app.get(Config).frontendUrl);
  await agent.post('/api/auth/sign-up/email').send(user).expect(200);
  return { agent, user };
}
