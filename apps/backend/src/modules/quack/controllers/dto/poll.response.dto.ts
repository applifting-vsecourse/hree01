import {
  POLL_RESULTS_VISIBILITIES,
  type PollResultsVisibility,
  type PollView,
} from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Null while results are hidden from this viewer',
  })
  votes!: number | null;
}

export class PollResponseDto {
  @ApiProperty({ enum: POLL_RESULTS_VISIBILITIES })
  resultsVisibility!: PollResultsVisibility;

  @ApiProperty()
  isClosed!: boolean;

  @ApiProperty({ description: 'Whether the viewer wrote this poll' })
  isAuthor!: boolean;

  @ApiProperty({ type: String, nullable: true })
  myOptionId!: string | null;

  @ApiProperty()
  resultsVisible!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Null while results are hidden from this viewer',
  })
  totalVotes!: number | null;

  @ApiProperty({ type: [PollOptionResponseDto] })
  options!: PollOptionResponseDto[];

  static fromDomain(poll: PollView): PollResponseDto {
    return {
      resultsVisibility: poll.resultsVisibility,
      isClosed: poll.isClosed,
      isAuthor: poll.isAuthor,
      myOptionId: poll.myOptionId,
      resultsVisible: poll.resultsVisible,
      totalVotes: poll.totalVotes,
      options: poll.options.map((option) => ({
        id: option.id,
        text: option.text,
        votes: option.votes,
      })),
    };
  }
}
