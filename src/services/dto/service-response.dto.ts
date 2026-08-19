import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Service,
  ServiceStatus,
  ServiceType,
} from '../entities/service.entity';
import { ServiceVersion } from '../entities/service-version.entity';

export class ServiceVersionResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'v2.1.0' }) name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) changelog: string | null;
  @ApiProperty() releasedAt: Date;

  static fromEntity(entity: ServiceVersion): ServiceVersionResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      changelog: entity.changelog,
      releasedAt: entity.releasedAt,
    };
  }
}

export class ServiceResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Payment Gateway' }) name: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: ServiceType }) type: ServiceType;
  @ApiProperty({ enum: ServiceStatus }) status: ServiceStatus;

  @ApiProperty({
    description: 'Number of versions available, for the card badge.',
    example: 4,
  })
  versionCount: number;

  @ApiPropertyOptional({
    type: [ServiceVersionResponseDto],
    description: 'Only present on the single-service endpoint.',
  })
  versions?: ServiceVersionResponseDto[];

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Service): ServiceResponseDto {
    const dto: ServiceResponseDto = {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      status: entity.status,
      // versionCount is mapped by the query; fall back to the loaded relation.
      versionCount: entity.versionCount ?? entity.versions?.length ?? 0,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    if (entity.versions) {
      dto.versions = entity.versions.map(ServiceVersionResponseDto.fromEntity);
    }

    return dto;
  }
}
