import { LikeState } from '@/modules/quack/domain/like';
import { ApiProperty } from '@nestjs/swagger';

export class LikeResponseDto {
  @ApiProperty({ description: 'Number of likes, counted on every read' })
  likeCount!: number;

  @ApiProperty({ description: 'Whether the signed-in user likes this quack' })
  likedByMe!: boolean;

  static fromDomain(likes: LikeState): LikeResponseDto {
    return { likeCount: likes.likeCount, likedByMe: likes.likedByMe };
  }
}
