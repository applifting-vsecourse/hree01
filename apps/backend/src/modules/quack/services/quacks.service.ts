import { Quack } from '@/modules/quack/domain/quack';
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
  async searchQuacks(user: Identity, query: string): Promise<Quack[]> {
    const terms = parseSearchTerms(query);
    const quacks = await this.quackRepository.getQuacks();
    if (terms.length === 0) return quacks;

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
    return results;
  }

  async createQuack(
    user: Identity,
    quackData: { text: string },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
