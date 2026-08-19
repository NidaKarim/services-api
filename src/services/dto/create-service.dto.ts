import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ServiceStatus, ServiceType } from '../entities/service.entity';
import { CreateServiceVersionDto } from './create-service-version.dto';

export class CreateServiceDto {
  @ApiProperty({ maxLength: 120, example: 'Payment Gateway' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({ example: 'Tokenizes cards and brokers authorizations.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ enum: ServiceType, default: ServiceType.REST })
  @IsOptional()
  @IsEnum(ServiceType)
  type?: ServiceType;

  @ApiPropertyOptional({ enum: ServiceStatus, default: ServiceStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({
    type: [CreateServiceVersionDto],
    description: 'Optional initial versions, created in the same transaction.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateServiceVersionDto)
  versions?: CreateServiceVersionDto[];
}
