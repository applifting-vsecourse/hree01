// Likes over HTTP against a real database: API behaviour A1–A13 in cases.md,
// plus the data rules R11–R12, which only the database can show.
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  createTestApp,
  postQuack,
  resetDatabase,
  signedInAgent,
} from '@/test/integration/test-app';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

type FeedQuack = {
  id: string;
  text: string | null;
  deletedBy: string | null;
  replyCount: number;
  poll: { options: { text: string }[] } | null;
  likeCount: number;
  likedByMe: boolean;
};

describe('Likes API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** The feed as the agent's user sees it. */
  const feed = async (agent: request.Agent, query = ''): Promise<FeedQuack[]> =>
    (await agent.get(`/api/quacks${query}`).expect(200)).body as FeedQuack[];

  const inFeed = async (
    agent: request.Agent,
    quackId: string,
    query = '',
  ): Promise<FeedQuack | undefined> =>
    (await feed(agent, query)).find((quack) => quack.id === quackId);

  /** Likes given directly in the database: the "given" of a case. */
  const givenLikes = async (
    quackId: string,
    ...userIds: string[]
  ): Promise<void> => {
    await prisma.like.createMany({
      data: userIds.map((userId) => ({ quackId, userId })),
    });
  };

  const storedLikes = (quackId: string): Promise<number> =>
    prisma.like.count({ where: { quackId } });

  // A1
  describe('signed out', () => {
    it.each(['put', 'delete'] as const)(
      'refuses %s with 401 and stores nothing',
      async (method) => {
        const { agent: author } = await signedInAgent(app);
        const quackId = await postQuack(author, { text: 'Bread is good' });

        await request(app.getHttpServer())
          [method](`/api/quacks/${quackId}/like`)
          .expect(401);

        expect(await storedLikes(quackId)).toBe(0);
      },
    );
  });

  // A2
  it('likes a quack and returns the new state', async () => {
    const { agent: author } = await signedInAgent(app);
    const { agent: me } = await signedInAgent(app);
    const quackId = await postQuack(author, { text: 'Bread is good' });

    const response = await me.put(`/api/quacks/${quackId}/like`).expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
  });

  // A3
  it('treats liking twice as success, counting one like', async () => {
    const { agent: author } = await signedInAgent(app);
    const { agent: me, user } = await signedInAgent(app);
    const quackId = await postQuack(author, { text: 'Bread is good' });
    await givenLikes(quackId, user.id);

    const response = await me.put(`/api/quacks/${quackId}/like`).expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await storedLikes(quackId)).toBe(1);
  });

  // A4
  it('takes a like back and returns the new state', async () => {
    const { agent: author } = await signedInAgent(app);
    const { agent: me, user } = await signedInAgent(app);
    const quackId = await postQuack(author, { text: 'Bread is good' });
    await givenLikes(quackId, user.id);

    const response = await me.delete(`/api/quacks/${quackId}/like`).expect(200);

    expect(response.body).toEqual({ likeCount: 0, likedByMe: false });
    expect(await storedLikes(quackId)).toBe(0);
  });

  // A5
  it('treats taking back a like never given as success', async () => {
    const { agent: author } = await signedInAgent(app);
    const { agent: me } = await signedInAgent(app);
    const quackId = await postQuack(author, { text: 'Bread is good' });

    const response = await me.delete(`/api/quacks/${quackId}/like`).expect(200);

    expect(response.body).toEqual({ likeCount: 0, likedByMe: false });
  });

  // A6
  it("shows each quack's count and the viewer's own like in the feed", async () => {
    const { agent: me, user: myself } = await signedInAgent(app);
    const { user: bob } = await signedInAgent(app);
    const { agent: carol } = await signedInAgent(app);
    const q1 = await postQuack(me, { text: 'Liked by two' });
    const q2 = await postQuack(me, { text: 'Liked by nobody' });
    await givenLikes(q1, myself.id, bob.id);

    expect(await inFeed(me, q1)).toMatchObject({
      likeCount: 2,
      likedByMe: true,
    });
    expect(await inFeed(me, q2)).toMatchObject({
      likeCount: 0,
      likedByMe: false,
    });
    expect(await inFeed(carol, q1)).toMatchObject({
      likeCount: 2,
      likedByMe: false,
    });
  });

  // A7
  it('shows the same count in Mine and in search results', async () => {
    const { agent: me } = await signedInAgent(app);
    const { user: bob } = await signedInAgent(app);
    const quackId = await postQuack(me, { text: 'café quack' });
    await givenLikes(quackId, bob.id);

    for (const query of ['?mine=true', `?q=${encodeURIComponent('café')}`]) {
      expect(await inFeed(me, quackId, query)).toMatchObject({
        likeCount: 1,
        likedByMe: false,
      });
    }
  });

  // A8
  it('keeps the feed newest first when an older quack is liked', async () => {
    const { agent: me } = await signedInAgent(app);
    const older = await postQuack(me, { text: 'Older' });
    const newer = await postQuack(me, { text: 'Newer' });

    await me.put(`/api/quacks/${older}/like`).expect(200);

    const ids = (await feed(me)).map((quack) => quack.id);
    expect(ids).toEqual([newer, older]);
  });

  // A9
  it('refuses to like a quack that does not exist with 404', async () => {
    const { agent: me } = await signedInAgent(app);

    await me.put('/api/quacks/no-such-quack/like').expect(404);
  });

  describe('a placeholder (deleted quack kept for its replies)', () => {
    /** A quack with a reply and `likerCount` likes, then deleted by its author. */
    const placeholderLikedBy = async (
      likerCount: number,
    ): Promise<{ quackId: string; me: request.Agent }> => {
      const { agent: author } = await signedInAgent(app);
      const { agent: replier } = await signedInAgent(app);
      const { agent: me } = await signedInAgent(app);
      const quackId = await postQuack(author, { text: 'Soon deleted' });
      await replier
        .post(`/api/quacks/${quackId}/replies`)
        .send({ text: 'A reply keeps it' })
        .expect(201);
      const likers = await Promise.all(
        Array.from(
          { length: likerCount },
          async () => (await signedInAgent(app)).user.id,
        ),
      );
      await givenLikes(quackId, ...likers);
      await author.delete(`/api/quacks/${quackId}`).expect(204);
      return { quackId, me };
    };

    // A10
    it.each(['put', 'delete'] as const)(
      'refuses %s on its like with 404',
      async (method) => {
        const { quackId, me } = await placeholderLikedBy(0);

        await me[method](`/api/quacks/${quackId}/like`).expect(404);

        expect(await storedLikes(quackId)).toBe(0);
      },
    );

    // A11
    it('carries no likes in the feed', async () => {
      const { quackId, me } = await placeholderLikedBy(2);

      expect(await inFeed(me, quackId)).toMatchObject({
        deletedBy: 'author',
        likeCount: 0,
        likedByMe: false,
      });
    });
  });

  // A12
  it('counts simultaneous likes, and a doubled request only once', async () => {
    const { agent: author } = await signedInAgent(app);
    const quackId = await postQuack(author, { text: 'Popular' });
    const likers = await Promise.all(
      [1, 2, 3, 4, 5].map(() => signedInAgent(app)),
    );

    const requests = likers.map(({ agent }) =>
      agent.put(`/api/quacks/${quackId}/like`),
    );
    requests.push(likers[0].agent.put(`/api/quacks/${quackId}/like`));
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.status)).toEqual(
      Array(6).fill(200),
    );
    expect(await storedLikes(quackId)).toBe(5);
    expect(await inFeed(author, quackId)).toMatchObject({ likeCount: 5 });
  });

  // A13
  it('likes quacks with a poll or with replies like any other', async () => {
    const { agent: author } = await signedInAgent(app);
    const { agent: me } = await signedInAgent(app);
    const withPoll = await postQuack(author, {
      text: 'Lunch?',
      poll: { options: ['Café', 'Bakery'] },
    });
    const withReplies = await postQuack(author, { text: 'Talk to me' });
    await author
      .post(`/api/quacks/${withReplies}/replies`)
      .send({ text: 'Hello' })
      .expect(201);

    for (const quackId of [withPoll, withReplies]) {
      const response = await me.put(`/api/quacks/${quackId}/like`).expect(200);
      expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    }

    expect(await inFeed(me, withPoll)).toMatchObject({
      poll: { options: [{ text: 'Café' }, { text: 'Bakery' }] },
    });
    expect(await inFeed(me, withReplies)).toMatchObject({ replyCount: 1 });
  });

  describe('deleting a quack', () => {
    // R11
    it('removes the likes of a quack without replies', async () => {
      const { agent: author } = await signedInAgent(app);
      const quackId = await postQuack(author, { text: 'Gone for good' });
      const likers = await Promise.all(
        [1, 2, 3].map(async () => (await signedInAgent(app)).user.id),
      );
      await givenLikes(quackId, ...likers);

      await author.delete(`/api/quacks/${quackId}`).expect(204);

      expect(await storedLikes(quackId)).toBe(0);
    });

    // R12
    it.each(['author', 'moderator'] as const)(
      'erases the likes of a quack that becomes a placeholder (deleted by its %s)',
      async (deletedBy) => {
        const { agent: author } = await signedInAgent(app);
        const { agent: moderator, user: moderatorUser } =
          await signedInAgent(app);
        await prisma.user.update({
          where: { id: moderatorUser.id },
          data: { role: 'admin' },
        });
        const quackId = await postQuack(author, { text: 'Has replies' });
        await author
          .post(`/api/quacks/${quackId}/replies`)
          .send({ text: 'Keeps it as a placeholder' })
          .expect(201);
        const likers = await Promise.all(
          [1, 2, 3].map(async () => (await signedInAgent(app)).user.id),
        );
        await givenLikes(quackId, ...likers);

        const deleter = deletedBy === 'author' ? author : moderator;
        await deleter.delete(`/api/quacks/${quackId}`).expect(204);

        expect(await storedLikes(quackId)).toBe(0);
        expect(await prisma.reply.count({ where: { quackId } })).toBe(1);
      },
    );
  });
});
