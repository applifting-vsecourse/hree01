// Likes: rules R1–R10 in cases.md. The repository is mocked, so these tests
// cover the service's part: it likes as the signed-in user (never anyone
// else), treats repeats as success, and turns a missing or deleted quack into
// a 404. That the counts themselves add up is the database's job, covered by
// the integration tests (quacks.likes.int-spec.ts).
import { LikeState } from '@/modules/quack/domain/like';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { NotFoundException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const me = { id: 'u1', role: 'user' } as Identity;
const alice = { id: 'alice', role: 'user' } as Identity;
const bob = { id: 'bob', role: 'user' } as Identity;
const admin = { id: 'a1', role: 'admin' } as Identity;

const likes = (likeCount: number, likedByMe: boolean): LikeState => ({
  likeCount,
  likedByMe,
});

describe('QuacksService likes', () => {
  let repository: MockProxy<QuackRepository>;
  let service: QuacksService;

  beforeEach(() => {
    repository = mock<QuackRepository>();
    service = new QuacksService(repository);
  });

  // R1
  it('likes a quack as the signed-in user and returns the new count', async () => {
    repository.likeQuack.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(me, 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect(repository.likeQuack).toHaveBeenCalledWith('q1', 'u1');
  });

  // R2
  it('treats liking a quack again as success, not as an error', async () => {
    // the repository ignores the repeat and reports the unchanged state
    repository.likeQuack.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(me, 'q1')).resolves.toEqual(likes(1, true));
    await expect(service.likeQuack(me, 'q1')).resolves.toEqual(likes(1, true));
    expect(repository.likeQuack).toHaveBeenCalledTimes(2);
  });

  // R3
  it('takes the like back as the signed-in user and returns the new count', async () => {
    repository.unlikeQuack.mockResolvedValue(likes(0, false));

    await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'u1');
  });

  // R4
  it('treats taking back a like that was never given as success', async () => {
    repository.unlikeQuack.mockResolvedValue(likes(2, false));

    await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual({
      likeCount: 2,
      likedByMe: false,
    });
  });

  // R5
  it("records each person's like as their own", async () => {
    repository.likeQuack
      .mockResolvedValueOnce(likes(1, true))
      .mockResolvedValueOnce(likes(2, true));

    await expect(service.likeQuack(alice, 'q1')).resolves.toEqual(
      likes(1, true),
    );
    await expect(service.likeQuack(bob, 'q1')).resolves.toEqual(likes(2, true));
    expect(repository.likeQuack).toHaveBeenNthCalledWith(1, 'q1', 'alice');
    expect(repository.likeQuack).toHaveBeenNthCalledWith(2, 'q1', 'bob');
  });

  // R6
  it("takes back only the signed-in user's like", async () => {
    repository.unlikeQuack.mockResolvedValue(likes(1, false));

    await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual(
      likes(1, false),
    );
    expect(repository.unlikeQuack).toHaveBeenCalledTimes(1);
    expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'u1');
  });

  // R7
  it('lets the author like their own quack, without checking who wrote it', async () => {
    repository.getQuackAuthorId.mockResolvedValue('u1');
    repository.likeQuack.mockResolvedValue(likes(1, true));

    await expect(service.likeQuack(me, 'q1')).resolves.toEqual(likes(1, true));
    expect(repository.getQuackAuthorId).not.toHaveBeenCalled();
  });

  // R8
  it("gives a moderator no power over other people's likes", async () => {
    repository.unlikeQuack.mockResolvedValue(likes(1, false));

    await expect(service.unlikeQuack(admin, 'q1')).resolves.toEqual(
      likes(1, false),
    );
    // the admin's own like, never Bob's
    expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'a1');
  });

  // R9, R10
  describe.each([
    ['a deleted quack (placeholder)', 'R9'],
    ['a quack that does not exist', 'R10'],
  ])('on %s (%s)', () => {
    beforeEach(() => {
      // the repository finds no live quack in both cases
      repository.likeQuack.mockResolvedValue(null);
      repository.unlikeQuack.mockResolvedValue(null);
    });

    it('refuses a like with 404', async () => {
      const like = service.likeQuack(me, 'q1');

      await expect(like).rejects.toBeInstanceOf(NotFoundException);
      await expect(like).rejects.toThrow('Quack not found');
    });

    it('refuses taking a like back with 404', async () => {
      const unlike = service.unlikeQuack(me, 'q1');

      await expect(unlike).rejects.toBeInstanceOf(NotFoundException);
      await expect(unlike).rejects.toThrow('Quack not found');
    });
  });
});
