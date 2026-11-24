import {
  FeedQuack,
  isPlaceholder,
  QUACK_DELETED_BY,
  QUACK_MOODS,
  type QuackDeletedBy,
  type QuackMood,
} from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { PollResponseDto } from './poll.response.dto';

export class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null on a placeholder (a deleted quack kept for its replies)',
  })
  text!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  mood!: QuackMood | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null on a placeholder: it shows no author',
  })
  userId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({
    type: QuackUserDto,
    nullable: true,
    description: 'Null on a placeholder: it shows no author',
  })
  user!: QuackUserDto | null;

  @ApiProperty({ type: PollResponseDto, nullable: true })
  poll!: PollResponseDto | null;

  @ApiProperty({
    enum: QUACK_DELETED_BY,
    nullable: true,
    description: 'Set on a placeholder: who deleted it. Null on a live quack.',
  })
  deletedBy!: QuackDeletedBy | null;

  @ApiProperty({ description: 'Number of replies, counted on every read' })
  replyCount!: number;

  @ApiProperty({ description: 'Number of likes, counted on every read' })
  likeCount!: number;

  @ApiProperty({ description: 'Whether the signed-in user likes this quack' })
  likedByMe!: boolean;

  static fromDomain(quack: FeedQuack): QuackResponseDto {
    if (!quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    const isDeleted = isPlaceholder(quack);
    return {
      id: quack.id,
      text: quack.text,
      mood: quack.mood,
      // The server keeps the owner of a placeholder, but nobody else sees it.
      userId: isDeleted ? null : quack.userId,
      createdAt: quack.createdAt,
      user: isDeleted
        ? null
        : {
            id: quack.user.id,
            name: quack.user.name,
            username: quack.user.username,
          },
      poll: quack.poll ? PollResponseDto.fromDomain(quack.poll) : null,
      deletedBy: quack.deletedBy,
      replyCount: quack.replyCount,
      // A placeholder's likes were erased with its content (docs/adr/0002).
      likeCount: isDeleted ? 0 : (quack.likeCount ?? 0),
      likedByMe: isDeleted ? false : (quack.likedByMe ?? false),
    };
  }
}
