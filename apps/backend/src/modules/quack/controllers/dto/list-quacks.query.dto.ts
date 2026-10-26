import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListQuacksQueryDto {
  @ApiPropertyOptional({
    description:
      'Only return quacks whose text, author name or username contains every word. Case- and diacritics-insensitive.',
    example: 'duck pond',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description:
      "Only return the signed-in user's own quacks. The user comes from the session, never from the request.",
    example: true,
  })
  @IsOptional()
  // query strings are text: "true"/"false" become booleans, anything else fails validation
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  mine?: boolean;
}
