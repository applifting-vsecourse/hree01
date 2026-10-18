import { EMPTY_POLL_STATS, toPollView } from '@/modules/quack/domain/poll';
import { FeedQuack, Quack, QuackMood } from '@/modules/quack/domain/quack';
import {
  matchesSearchTerms,
  parseSearchTerms,
} from '@/modules/quack/domain/quack-search';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable, Logger } from '@nestjs/common';

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
    quackData: { text: string; mood: QuackMood | null },
  ): Promise<FeedQuack> {
    const quack = await this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
    const [created] = await this.withPollViews([quack], user);
    return created;
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
