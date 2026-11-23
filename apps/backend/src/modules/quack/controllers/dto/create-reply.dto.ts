import {
  QUACK_TEXT_MAX_LENGTH,
  quackTextMessages,
} from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReplyDto {
  @ApiProperty({
    description: 'Body of the reply, trimmed',
    example: 'The café by the pond, obviously.',
    maxLength: QUACK_TEXT_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: quackTextMessages.empty })
  @MaxLength(QUACK_TEXT_MAX_LENGTH, { message: quackTextMessages.tooLong })
  text!: string;
}
