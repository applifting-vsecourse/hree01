import { QUACK_MOODS, type QuackMood } from '@/modules/quack/domain/quack';
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
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
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
