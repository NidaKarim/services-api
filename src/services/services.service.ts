import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Service } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';
import { FindServicesQueryDto } from './dto/find-services-query.dto';

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
}
