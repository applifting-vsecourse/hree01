import {
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_RESULTS_VISIBILITIES,
  type PollResultsVisibility,
} from '@/modules/quack/domain/poll';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class CreatePollDto {
  @ApiProperty({
    description: `${POLL_MIN_OPTIONS}–${POLL_MAX_OPTIONS} answers, unique regardless of case`,
    example: ['The café by the pond', 'Bakery on the corner'],
    type: [String],
    maxLength: POLL_OPTION_MAX_LENGTH,
  })
  @Transform(trimEach)
  @IsArray()
  @ArrayMinSize(POLL_MIN_OPTIONS, {
    message: `A poll needs at least ${POLL_MIN_OPTIONS} options`,
  })
  @ArrayMaxSize(POLL_MAX_OPTIONS, {
    message: `A poll can have at most ${POLL_MAX_OPTIONS} options`,
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Every option needs some text' })
  @MaxLength(POLL_OPTION_MAX_LENGTH, {
    each: true,
    message: `Keep each option under ${POLL_OPTION_MAX_LENGTH} characters`,
  })
  @ArrayUnique(
    (option: unknown) =>
      typeof option === 'string' ? option.toLowerCase() : option,
    { message: 'Options must be different from each other' },
  )
  options!: string[];

  @ApiPropertyOptional({
    enum: POLL_RESULTS_VISIBILITIES,
    default: 'right_away',
  })
  @IsOptional()
  @IsIn(POLL_RESULTS_VISIBILITIES)
  resultsVisibility?: PollResultsVisibility;
}
