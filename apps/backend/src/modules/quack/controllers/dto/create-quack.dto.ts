import {
  QUACK_MOODS,
  QUACK_TEXT_MAX_LENGTH,
  quackTextMessages,
  type QuackMood,
} from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreatePollDto } from './create-poll.dto';

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: QUACK_TEXT_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty({ message: quackTextMessages.empty })
  @MaxLength(QUACK_TEXT_MAX_LENGTH, { message: quackTextMessages.tooLong })
  text!: string;

  @ApiPropertyOptional({
    description: 'Mood of the quack',
    enum: QUACK_MOODS,
    nullable: true,
    example: 'silly',
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  mood?: QuackMood | null;

  @ApiPropertyOptional({
    description: 'Turns the quack into a poll; its text is the question',
    type: CreatePollDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto | null;
}
