import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { FindServicesQueryDto } from './dto/find-services-query.dto';
import {
  ServiceResponseDto,
  ServiceVersionResponseDto,
} from './dto/service-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@ApiTags('services')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List services',
    description:
      'Backs the dashboard widget: supports search, filtering, sorting, and pagination.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto<ServiceResponseDto> })
  async findAll(
    @Query() query: FindServicesQueryDto,
  ): Promise<PaginatedResponseDto<ServiceResponseDto>> {
    const { items, total } = await this.servicesService.findAll(query);

    return new PaginatedResponseDto(
      items.map(ServiceResponseDto.fromEntity),
      total,
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fetch a single service',
    description: 'Includes the full version list, newest first.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiNotFoundResponse({ description: 'No service with that id.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceResponseDto> {
    const service = await this.servicesService.findOne(id);
    return ServiceResponseDto.fromEntity(service);
  }

  @Get(':id/versions')
  @ApiOperation({
    summary: 'List the versions of a service',
    description: 'Newest first. Returns 404 if the service does not exist.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [ServiceVersionResponseDto] })
  @ApiNotFoundResponse({ description: 'No service with that id.' })
  async findVersions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceVersionResponseDto[]> {
    const versions = await this.servicesService.findVersions(id);
    return versions.map(ServiceVersionResponseDto.fromEntity);
  }
}
