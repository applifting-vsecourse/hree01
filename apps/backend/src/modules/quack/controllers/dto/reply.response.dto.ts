import { Reply } from '@/modules/quack/domain/reply';
import { ApiProperty } from '@nestjs/swagger';
import { QuackUserDto } from './quack.response.dto';

export class ReplyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  quackId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto })
  user!: QuackUserDto;

  static fromDomain(reply: Reply): ReplyResponseDto {
    return {
      id: reply.id,
      text: reply.text,
      quackId: reply.quackId,
      userId: reply.userId,
      createdAt: reply.createdAt,
      user: {
        id: reply.user.id,
        name: reply.user.name,
        username: reply.user.username,
      },
    };
  }
}
