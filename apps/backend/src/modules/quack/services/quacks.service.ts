import { LikeState } from '@/modules/quack/domain/like';
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
import { Reply } from '@/modules/quack/domain/reply';
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
  async searchQuacks(
    user: Identity,
    query: string,
    filter: { mine?: boolean } = {},
  ): Promise<FeedQuack[]> {
    const terms = parseSearchTerms(query);
    const quacks = await this.quackRepository.getQuacks(
      filter.mine
        ? // "mine" is whoever is signed in, never an id from the request;
          // a deleted quack kept for its replies is no longer theirs to list
          { authorId: user.id, liveOnly: true }
        : {},
    );
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

  /**
   * The author deletes their own quack; an admin (moderator) can delete any.
   * A quack with replies becomes a placeholder instead of disappearing.
   */
  async deleteQuack(user: Identity, quackId: string): Promise<void> {
    const authorId = await this.quackRepository.getQuackAuthorId(quackId);
    if (!authorId) throw new NotFoundException('Quack not found');

    // The one permission check. It is here, not in the UI, so it also holds
    // for direct API calls. A quack's author never changes, so checking first
    // and deleting after leaves no gap.
    const isOwner = authorId === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only delete your own quacks');
    }

    const result = await this.quackRepository.deleteQuack(
      quackId,
      isOwner ? 'author' : 'moderator',
    );
    // someone else deleted it between the lookup and now
    if (result === 'not_found') throw new NotFoundException('Quack not found');

    if (!isOwner) {
      // Moderation trail: who removed whose quack. The text is deliberately not logged.
      this.logger.log(
        JSON.stringify({
          event: 'quacks.moderated_delete',
          moderatorId: user.id,
          authorId,
          quackId,
          at: new Date().toISOString(),
        }),
      );
    }
  }

  /** Likes a live quack as the signed-in user; liking twice is not an error. */
  async likeQuack(user: Identity, quackId: string): Promise<LikeState> {
    throw new Error(`Not implemented: like quack ${quackId} as ${user.id}`);
  }

  /** Takes the signed-in user's like back; without one this is not an error. */
  async unlikeQuack(user: Identity, quackId: string): Promise<LikeState> {
    throw new Error(`Not implemented: unlike quack ${quackId} as ${user.id}`);
  }

  /** A quack's replies, oldest first. A placeholder's replies too. */
  async getReplies(quackId: string): Promise<Reply[]> {
    const replies = await this.quackRepository.getReplies(quackId);
    if (!replies) throw new NotFoundException('Quack not found');
    return replies;
  }

  async createReply(
    user: Identity,
    quackId: string,
    text: string,
  ): Promise<Reply> {
    const result = await this.quackRepository.createReply({
      quackId,
      text,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
    switch (result.status) {
      case 'not_found':
        throw new NotFoundException('Quack not found');
      case 'quack_deleted':
        throw new ConflictException('This quack was deleted');
      case 'ok':
        return result.reply;
    }
  }

  /** The author deletes their own reply; an admin (moderator) can delete any. */
  async deleteReply(
    user: Identity,
    quackId: string,
    replyId: string,
  ): Promise<void> {
    const authorId = await this.quackRepository.getReplyAuthorId(
      quackId,
      replyId,
    );
    if (!authorId) throw new NotFoundException('Reply not found');

    // Same rule as for quacks, checked here so it holds for direct API calls.
    const isOwner = authorId === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only delete your own replies');
    }

    const deleted = await this.quackRepository.deleteReply(quackId, replyId);
    if (!deleted) throw new NotFoundException('Reply not found');

    if (!isOwner) {
      // Moderation trail, like for quacks. The text is deliberately not logged.
      this.logger.log(
        JSON.stringify({
          event: 'replies.moderated_delete',
          moderatorId: user.id,
          authorId,
          replyId,
          quackId,
          at: new Date().toISOString(),
        }),
      );
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
