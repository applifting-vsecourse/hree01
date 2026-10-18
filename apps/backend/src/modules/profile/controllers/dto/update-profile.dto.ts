import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/modules/profile/domain/profile';
import { QUACK_MOODS, type QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiProperty({ example: 'Caffeinated Duck', maxLength: NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({
    description: 'Letters, digits, dots and underscores',
    example: 'CaffeinatedDuck',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain letters, digits, dots and underscores',
  })
  username!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Mostly here for the bread.',
    maxLength: BIO_MAX_LENGTH,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  bio!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true, example: 'silly' })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  defaultMood!: QuackMood | null;
}
