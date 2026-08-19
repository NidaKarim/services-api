import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceVersionDto } from './dto/create-service-version.dto';
import { UpdateServiceVersionDto } from './dto/update-service-version.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

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

  // --- Writes (admin only) ------------------------------------------------

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a service',
    description: 'Optionally creates initial versions in the same transaction.',
  })
  @ApiCreatedResponse({ type: ServiceResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  @ApiConflictResponse({ description: 'A service with that name exists.' })
  async create(@Body() dto: CreateServiceDto): Promise<ServiceResponseDto> {
    const service = await this.servicesService.create(dto);
    return ServiceResponseDto.fromEntity(service);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a service' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  @ApiNotFoundResponse({ description: 'No service with that id.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    const service = await this.servicesService.update(id, dto);
    return ServiceResponseDto.fromEntity(service);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a service',
    description: 'Cascades to the service versions.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  @ApiNotFoundResponse({ description: 'No service with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.servicesService.remove(id);
  }

  @Post(':id/versions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a version to a service' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ServiceVersionResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  @ApiNotFoundResponse({ description: 'No service with that id.' })
  @ApiConflictResponse({ description: 'That version already exists.' })
  async addVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceVersionDto,
  ): Promise<ServiceVersionResponseDto> {
    const version = await this.servicesService.addVersion(id, dto);
    return ServiceVersionResponseDto.fromEntity(version);
  }

  @Patch(':id/versions/:versionId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a version' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiOkResponse({ type: ServiceVersionResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  @ApiNotFoundResponse({ description: 'No such service or version.' })
  async updateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateServiceVersionDto,
  ): Promise<ServiceVersionResponseDto> {
    const version = await this.servicesService.updateVersion(
      id,
      versionId,
      dto,
    );
    return ServiceVersionResponseDto.fromEntity(version);
  }

  @Delete(':id/versions/:versionId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a version' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  @ApiNotFoundResponse({ description: 'No such service or version.' })
  removeVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<void> {
    return this.servicesService.removeVersion(id, versionId);
  }
}
