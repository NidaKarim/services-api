import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ServiceStatus, ServiceType } from '../entities/service.entity';

/**
 * Whitelist of sortable columns. Sorting is interpolated into the query, so
 * this must stay a closed set — never accept a raw column name from a client.
 */
export const SERVICE_SORT_FIELDS = [
  'name',
  'createdAt',
  'updatedAt',
  'versionCount',
] as const;
export type ServiceSortField = (typeof SERVICE_SORT_FIELDS)[number];

export type SortOrder = 'ASC' | 'DESC';

export class FindServicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match against service name and description.',
    example: 'payment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({
    enum: ServiceType,
    description: 'Filter by the protocol the service exposes.',
  })
  @IsOptional()
  @IsEnum(ServiceType)
  type?: ServiceType;

  @ApiPropertyOptional({
    enum: ServiceStatus,
    description: 'Filter by lifecycle status.',
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({
    enum: SERVICE_SORT_FIELDS,
    default: 'name',
    description:
      'Field to sort by. `versionCount` orders by the number of versions, so `order=DESC` puts the most-versioned services first.',
  })
  @IsOptional()
  @IsIn(SERVICE_SORT_FIELDS)
  sort: ServiceSortField = 'name';

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    default: 'ASC',
    description: 'Sort direction.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  order: SortOrder = 'ASC';
}
