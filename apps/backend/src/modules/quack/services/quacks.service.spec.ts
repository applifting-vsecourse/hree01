// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Poll } from '@/modules/quack/domain/poll';
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  poll: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

describe('QuacksService', () => {
  const user = { id: 'u1' } as Identity;

  afterEach(() => jest.restoreAllMocks());

  it('returns all quacks from the repository for a blank search', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(service.searchQuacks(user, '   ')).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
    // a blank search is not a search, so it is not counted
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('attaches each poll as this viewer sees it, fetching stats only for returned polls', async () => {
    const poll: Poll = {
      quackId: 'q1',
      resultsVisibility: 'right_away',
      closedAt: null,
      options: [
        { id: 'o1', text: 'Café' },
        { id: 'o2', text: 'Bakery' },
      ],
    };
    const withPoll = aQuack({ id: 'q1', text: 'Lunch at the café?', poll });
    const otherPoll = aQuack({
      id: 'q2',
      text: 'Geese or swans?',
      userId: 'u2',
      poll: { ...poll, quackId: 'q2' },
    });
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([withPoll, otherPoll]);
    repository.getPollStats.mockResolvedValue(
      new Map([
        ['q1', { votesByOption: new Map([['o2', 2]]), myOptionId: 'o2' }],
      ]),
    );

    const service = new QuacksService(repository);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const [result] = await service.searchQuacks(user, 'cafe');

    expect(repository.getPollStats).toHaveBeenCalledWith(['q1'], 'u1');
    expect(result.poll).toEqual({
      resultsVisibility: 'right_away',
      isClosed: false,
      isAuthor: true,
      myOptionId: 'o2',
      resultsVisible: true,
      totalVotes: 2,
      options: [
        { id: 'o1', text: 'Café', votes: 0 },
        { id: 'o2', text: 'Bakery', votes: 2 },
      ],
    });
  });

  it('returns only matching quacks and logs the search without its text', async () => {
    const match = aQuack({ id: 'q1', text: 'Ducks by the café' });
    const other = aQuack({ id: 'q2', text: 'Geese in the meadow' });
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([match, other]);

    const service = new QuacksService(repository);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(service.searchQuacks(user, 'cafe')).resolves.toEqual([match]);
    expect(log).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(log.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    expect(entry).toMatchObject({
      event: 'quacks.search',
      userId: 'u1',
      resultCount: 1,
    });
    expect(JSON.stringify(entry)).not.toContain('cafe');
    log.mockRestore();
  });

  it("filters to the signed-in user's quacks and still searches", async () => {
    const mine = aQuack({ id: 'q1', text: 'Ducks by the café' });
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([mine]);

    const service = new QuacksService(repository);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(
      service.searchQuacks(user, 'cafe', { mine: true }),
    ).resolves.toEqual([mine]);
    // the author is the session's user
    expect(repository.getQuacks).toHaveBeenCalledWith({ authorId: 'u1' });
  });

  it('does not filter by author unless asked for "mine"', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue([]);

    await new QuacksService(repository).searchQuacks(user, '');

    expect(repository.getQuacks).toHaveBeenCalledWith({ authorId: undefined });
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, { text: 'hello', mood: null, poll: null }),
    ).resolves.toEqual(created);
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
      poll: null,
      userId: 'u1',
    });
  });

  it('passes the mood through to the repository', async () => {
    const created = aQuack({ id: 'q3', text: 'lol', mood: 'silly' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, { text: 'lol', mood: 'silly', poll: null }),
    ).resolves.toEqual(created);
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'lol',
      mood: 'silly',
      poll: null,
      userId: 'u1',
    });
  });

  it('creates a poll with the quack and returns it with no votes yet', async () => {
    const poll = {
      options: ['Café', 'Bakery'],
      resultsVisibility: 'after_voting' as const,
    };
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(
      aQuack({
        id: 'q4',
        text: 'Lunch?',
        poll: {
          quackId: 'q4',
          resultsVisibility: 'after_voting',
          closedAt: null,
          options: [
            { id: 'o1', text: 'Café' },
            { id: 'o2', text: 'Bakery' },
          ],
        },
      }),
    );
    repository.getPollStats.mockResolvedValue(new Map());

    const service = new QuacksService(repository);
    const created = await service.createQuack(user, {
      text: 'Lunch?',
      mood: null,
      poll,
    });

    expect(repository.createQuack).toHaveBeenCalledWith(
      expect.objectContaining({ poll }),
    );
    expect(created.poll).toMatchObject({
      isAuthor: true,
      myOptionId: null,
      resultsVisible: false,
      totalVotes: null,
    });
  });

  describe('voting and closing', () => {
    const lunchPoll: Poll = {
      quackId: 'q1',
      resultsVisibility: 'after_voting',
      closedAt: null,
      options: [
        { id: 'o1', text: 'Café' },
        { id: 'o2', text: 'Bakery' },
      ],
    };

    const repositoryWithPoll = (): ReturnType<typeof mock<QuackRepository>> => {
      const repository = mock<QuackRepository>();
      repository.getPoll.mockResolvedValue({ poll: lunchPoll, authorId: 'u2' });
      repository.getPollStats.mockResolvedValue(
        new Map([
          ['q1', { votesByOption: new Map([['o1', 3]]), myOptionId: 'o1' }],
        ]),
      );
      return repository;
    };

    it('votes as the signed-in user and returns the poll as they now see it', async () => {
      const repository = repositoryWithPoll();
      repository.setVote.mockResolvedValue('ok');

      const service = new QuacksService(repository);
      const view = await service.setVote(user, 'q1', 'o1');

      expect(repository.setVote).toHaveBeenCalledWith('q1', 'u1', 'o1');
      expect(view).toMatchObject({
        myOptionId: 'o1',
        resultsVisible: true,
        totalVotes: 3,
        isAuthor: false,
      });
    });

    it('removes a vote when no option is given', async () => {
      const repository = repositoryWithPoll();
      repository.setVote.mockResolvedValue('ok');

      await new QuacksService(repository).setVote(user, 'q1', null);

      expect(repository.setVote).toHaveBeenCalledWith('q1', 'u1', null);
    });

    it.each([
      ['not_found', NotFoundException, 'Poll not found'],
      ['closed', ConflictException, 'This poll is closed'],
      [
        'invalid_option',
        BadRequestException,
        'That option is not part of this poll',
      ],
    ] as const)(
      'turns a %s vote into a readable HTTP error',
      async (result, ErrorType, message) => {
        const repository = repositoryWithPoll();
        repository.setVote.mockResolvedValue(result);

        const vote = new QuacksService(repository).setVote(user, 'q1', 'o9');

        await expect(vote).rejects.toBeInstanceOf(ErrorType);
        await expect(vote).rejects.toThrow(message);
      },
    );

    it('closes the poll for its author', async () => {
      const repository = repositoryWithPoll();
      repository.closePoll.mockResolvedValue('ok');

      await new QuacksService(repository).closePoll(user, 'q1');

      expect(repository.closePoll).toHaveBeenCalledWith('q1', 'u1');
    });

    it('refuses to close a poll for someone else', async () => {
      const repository = repositoryWithPoll();
      repository.closePoll.mockResolvedValue('forbidden');

      const close = new QuacksService(repository).closePoll(user, 'q1');

      await expect(close).rejects.toBeInstanceOf(ForbiddenException);
      await expect(close).rejects.toThrow(
        'Only the author can close this poll',
      );
    });
  });

  describe('deleting', () => {
    it("deletes the signed-in user's own quack", async () => {
      const repository = mock<QuackRepository>();
      repository.deleteQuack.mockResolvedValue('ok');

      await expect(
        new QuacksService(repository).deleteQuack(user, 'q1'),
      ).resolves.toBeUndefined();

      // the author comes from the session, not from the caller
      expect(repository.deleteQuack).toHaveBeenCalledWith('q1', 'u1');
    });

    it("refuses to delete someone else's quack", async () => {
      const repository = mock<QuackRepository>();
      repository.deleteQuack.mockResolvedValue('forbidden');

      const remove = new QuacksService(repository).deleteQuack(user, 'q1');

      await expect(remove).rejects.toBeInstanceOf(ForbiddenException);
      await expect(remove).rejects.toThrow(
        'You can only delete your own quacks',
      );
    });

    it('reports a quack that does not exist', async () => {
      const repository = mock<QuackRepository>();
      repository.deleteQuack.mockResolvedValue('not_found');

      const remove = new QuacksService(repository).deleteQuack(user, 'q1');

      await expect(remove).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
