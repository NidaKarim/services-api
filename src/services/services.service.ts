import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { Service } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';
import { FindServicesQueryDto } from './dto/find-services-query.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceVersionDto } from './dto/create-service-version.dto';
import { UpdateServiceVersionDto } from './dto/update-service-version.dto';

/** Postgres unique_violation. */
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(ServiceVersion)
    private readonly versionRepository: Repository<ServiceVersion>,
  ) {}

  /**
   * Escapes the LIKE wildcards so a search for "50%" matches the literal text
   * rather than turning into a wildcard. Paired with ESCAPE '\' in the query.
   */
  private static escapeLike(input: string): string {
    return input.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  async findAll(
    query: FindServicesQueryDto,
  ): Promise<{ items: Service[]; total: number }> {
    const qb = this.serviceRepository.createQueryBuilder('service');

    this.applyFilters(qb, query);

    // One extra aggregate query instead of hydrating every version row.
    qb.loadRelationCountAndMap('service.versionCount', 'service.versions');

    this.applySorting(qb, query);

    qb.skip(query.skip).take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Service>,
    query: FindServicesQueryDto,
  ): void {
    if (query.search) {
      const term = `%${ServicesService.escapeLike(query.search)}%`;
      qb.andWhere(
        `(service.name ILIKE :term ESCAPE '\\' OR service.description ILIKE :term ESCAPE '\\')`,
        { term },
      );
    }

    if (query.type) {
      qb.andWhere('service.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('service.status = :status', { status: query.status });
    }
  }

  /**
   * `versionCount` is not a column — loadRelationCountAndMap resolves it in a
   * second query, which the database cannot sort by. A correlated subquery
   * gives the planner something to order on while keeping the main query
   * join-free, so LIMIT/OFFSET stay plain and pagination is unaffected.
   */
  private static readonly VERSION_COUNT_EXPRESSION =
    '(SELECT COUNT(*) FROM "service_versions" "vc" WHERE "vc"."service_id" = "service"."id")';

  private applySorting(
    qb: SelectQueryBuilder<Service>,
    query: FindServicesQueryDto,
  ): void {
    if (query.sort === 'versionCount') {
      qb.orderBy(ServicesService.VERSION_COUNT_EXPRESSION, query.order);
    } else {
      // `sort` is validated against a whitelist in the DTO, so interpolating
      // it as a column name is safe.
      qb.orderBy(`service.${query.sort}`, query.order);
    }

    // Deterministic tiebreaker: without it, equal sort keys can shuffle
    // between pages and the client sees duplicates or gaps. It matters most
    // for versionCount, where ties are common.
    qb.addOrderBy('service.id', 'ASC');
  }

  /**
   * Single service with its versions inlined — the detail view after the user
   * clicks through from a card.
   */
  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id },
      relations: { versions: true },
      order: { versions: { releasedAt: 'DESC' } },
    });

    if (!service) {
      throw new NotFoundException(`Service with id "${id}" was not found`);
    }

    return service;
  }

  /**
   * Versions for a service, newest first. Checks the parent exists so a bad id
   * returns 404 rather than a misleading empty list.
   */
  async findVersions(serviceId: string): Promise<ServiceVersion[]> {
    await this.assertExists(serviceId);

    return this.versionRepository.find({
      where: { serviceId },
      order: { releasedAt: 'DESC' },
    });
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.serviceRepository.exist({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Service with id "${id}" was not found`);
    }
  }

  // --- Writes -------------------------------------------------------------

  /**
   * Relies on the database unique constraints rather than a read-then-write
   * check, which would race under concurrent requests.
   */
  private static rethrowAsConflict(error: unknown, message: string): never {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { code?: string }).code ===
        PG_UNIQUE_VIOLATION
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const service = this.serviceRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type,
      status: dto.status,
      versions: (dto.versions ?? []).map((v) =>
        this.versionRepository.create({
          name: v.name,
          description: v.description ?? null,
          changelog: v.changelog ?? null,
          releasedAt: v.releasedAt ? new Date(v.releasedAt) : new Date(),
        }),
      ),
    });

    try {
      // `cascade: ['insert']` saves the service and its versions atomically.
      const saved = await this.serviceRepository.save(service);
      return this.findOne(saved.id);
    } catch (error) {
      // Service names are not unique, so the only unique constraint this can
      // trip is (service_id, name) on versions — a payload repeating a
      // version name.
      ServicesService.rethrowAsConflict(
        error,
        'The submitted versions contain duplicate version names',
      );
    }
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.serviceRepository.preload({ id, ...dto });

    if (!service) {
      throw new NotFoundException(`Service with id "${id}" was not found`);
    }

    // No unique constraint on any updatable column, so nothing here can
    // conflict.
    await this.serviceRepository.save(service);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    // Versions go with it via ON DELETE CASCADE.
    const result = await this.serviceRepository.delete({ id });

    if (!result.affected) {
      throw new NotFoundException(`Service with id "${id}" was not found`);
    }
  }

  async addVersion(
    serviceId: string,
    dto: CreateServiceVersionDto,
  ): Promise<ServiceVersion> {
    await this.assertExists(serviceId);

    const version = this.versionRepository.create({
      serviceId,
      name: dto.name,
      description: dto.description ?? null,
      changelog: dto.changelog ?? null,
      releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : new Date(),
    });

    try {
      return await this.versionRepository.save(version);
    } catch (error) {
      ServicesService.rethrowAsConflict(
        error,
        `Version "${dto.name}" already exists for this service`,
      );
    }
  }

  async updateVersion(
    serviceId: string,
    versionId: string,
    dto: UpdateServiceVersionDto,
  ): Promise<ServiceVersion> {
    const version = await this.findVersionOrFail(serviceId, versionId);

    Object.assign(version, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.changelog !== undefined && { changelog: dto.changelog }),
      ...(dto.releasedAt !== undefined && {
        releasedAt: new Date(dto.releasedAt),
      }),
    });

    try {
      return await this.versionRepository.save(version);
    } catch (error) {
      ServicesService.rethrowAsConflict(
        error,
        `Version "${dto.name}" already exists for this service`,
      );
    }
  }

  async removeVersion(serviceId: string, versionId: string): Promise<void> {
    await this.findVersionOrFail(serviceId, versionId);
    await this.versionRepository.delete({ id: versionId });
  }

  /**
   * Scopes the lookup to the parent so /services/A/versions/{a version of B}
   * is a 404 rather than an accidental cross-service edit.
   */
  private async findVersionOrFail(
    serviceId: string,
    versionId: string,
  ): Promise<ServiceVersion> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId, serviceId },
    });

    if (!version) {
      throw new NotFoundException(
        `Version "${versionId}" was not found on service "${serviceId}"`,
      );
    }

    return version;
  }
}
