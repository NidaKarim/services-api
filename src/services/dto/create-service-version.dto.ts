import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateServiceVersionDto {
  @ApiProperty({ maxLength: 40, example: 'v2.1.0' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @ApiPropertyOptional({ example: 'Partial refunds.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'Support partial and multi-step refunds.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  changelog?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp. Defaults to now when omitted.',
    example: '2024-01-22T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  releasedAt?: string;
}
