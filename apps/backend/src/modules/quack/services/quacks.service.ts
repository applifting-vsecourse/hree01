import {
  EMPTY_POLL_STATS,
  NewPoll,
  PollView,
  toPollView,
} from '@/modules/quack/domain/poll';
import { FeedQuack, Quack, QuackMood } from '@/modules/quack/domain/quack';
import {
  matchesSearchTerms,
  parseSearchTerms,
} from '@/modules/quack/domain/quack-search';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  /**
   * Filters the feed in memory: the feed is already loaded in full, and this
   * keeps diacritics-insensitive matching free of database extensions. Revisit
   * when the feed gets pagination.
   */
  async searchQuacks(user: Identity, query: string): Promise<FeedQuack[]> {
    const terms = parseSearchTerms(query);
    const quacks = await this.quackRepository.getQuacks();
    if (terms.length === 0) return this.withPollViews(quacks, user);

    const results = quacks.filter((quack) => matchesSearchTerms(quack, terms));
    // Usage metric for the product owner: weekly unique searchers and the share
    // of searches with no results. The query text is deliberately not logged.
    this.logger.log(
      JSON.stringify({
        event: 'quacks.search',
        userId: user.id,
        resultCount: results.length,
        at: new Date().toISOString(),
      }),
    );
    return this.withPollViews(results, user);
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood: QuackMood | null; poll: NewPoll | null },
  ): Promise<FeedQuack> {
    const quack = await this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      poll: quackData.poll,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
    const [created] = await this.withPollViews([quack], user);
    return created;
  }

  /** Votes for an option, or with `optionId: null` removes the vote. */
  async setVote(
    user: Identity,
    quackId: string,
    optionId: string | null,
  ): Promise<PollView> {
    const result = await this.quackRepository.setVote(
      quackId,
      user.id,
      optionId,
    );
    switch (result) {
      case 'not_found':
        throw new NotFoundException('Poll not found');
      case 'closed':
        throw new ConflictException('This poll is closed');
      case 'invalid_option':
        throw new BadRequestException('That option is not part of this poll');
      case 'ok':
        return this.getPollView(user, quackId);
    }
  }

  async closePoll(user: Identity, quackId: string): Promise<PollView> {
    const result = await this.quackRepository.closePoll(quackId, user.id);
    switch (result) {
      case 'not_found':
        throw new NotFoundException('Poll not found');
      case 'forbidden':
        throw new ForbiddenException('Only the author can close this poll');
      case 'ok':
        return this.getPollView(user, quackId);
    }
  }

  private async getPollView(
    viewer: Identity,
    quackId: string,
  ): Promise<PollView> {
    const found = await this.quackRepository.getPoll(quackId);
    if (!found) throw new NotFoundException('Poll not found');
    const stats = await this.quackRepository.getPollStats([quackId], viewer.id);
    return toPollView(found.poll, stats.get(quackId) ?? EMPTY_POLL_STATS, {
      isAuthor: found.authorId === viewer.id,
    });
  }

  private async withPollViews(
    quacks: Quack[],
    viewer: Identity,
  ): Promise<FeedQuack[]> {
    // Stats only for the polls actually being returned, e.g. search results.
    const pollQuackIds = quacks
      .filter((quack) => quack.poll !== null)
      .map((quack) => quack.id);
    if (pollQuackIds.length === 0) {
      return quacks.map((quack) => ({ ...quack, poll: null }));
    }
    const stats = await this.quackRepository.getPollStats(
      pollQuackIds,
      viewer.id,
    );

    return quacks.map((quack) => ({
      ...quack,
      poll: quack.poll
        ? toPollView(quack.poll, stats.get(quack.id) ?? EMPTY_POLL_STATS, {
            isAuthor: quack.userId === viewer.id,
          })
        : null,
    }));
  }
}
