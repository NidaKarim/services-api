import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ServicesService } from './services.service';
import { Service, ServiceStatus, ServiceType } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';
import { FindServicesQueryDto } from './dto/find-services-query.dto';

/**
 * Chainable query-builder double. Records every andWhere/orderBy call so the
 * tests can assert on the SQL fragments and parameters the service produced.
 */
const createQueryBuilderMock = (result: [Service[], number]) => {
  const calls = {
    andWhere: [] as Array<[string, Record<string, unknown>?]>,
    orderBy: [] as Array<[string, string]>,
    addOrderBy: [] as Array<[string, string]>,
    loadRelationCountAndMap: [] as Array<[string, string]>,
    skip: [] as number[],
    take: [] as number[],
  };

  const qb: any = {
    andWhere: jest.fn((...args: any[]) => {
      calls.andWhere.push(args as any);
      return qb;
    }),
    orderBy: jest.fn((...args: any[]) => {
      calls.orderBy.push(args as any);
      return qb;
    }),
    addOrderBy: jest.fn((...args: any[]) => {
      calls.addOrderBy.push(args as any);
      return qb;
    }),
    loadRelationCountAndMap: jest.fn((...args: any[]) => {
      calls.loadRelationCountAndMap.push(args as any);
      return qb;
    }),
    skip: jest.fn((n: number) => {
      calls.skip.push(n);
      return qb;
    }),
    take: jest.fn((n: number) => {
      calls.take.push(n);
      return qb;
    }),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };

  return { qb, calls };
};

const buildService = (overrides: Partial<Service> = {}): Service =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Payment Gateway',
    description: 'Brokers authorizations.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Service);

describe('ServicesService', () => {
  let service: ServicesService;
  let serviceRepo: jest.Mocked<any>;
  let versionRepo: jest.Mocked<any>;

  beforeEach(async () => {
    serviceRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      exist: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn(),
      preload: jest.fn(),
      delete: jest.fn(),
    };
    versionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: getRepositoryToken(Service), useValue: serviceRepo },
        { provide: getRepositoryToken(ServiceVersion), useValue: versionRepo },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  describe('findAll', () => {
    const runFindAll = async (
      overrides: Partial<FindServicesQueryDto> = {},
    ) => {
      const query = Object.assign(new FindServicesQueryDto(), overrides);
      const { qb, calls } = createQueryBuilderMock([[buildService()], 1]);
      serviceRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findAll(query);
      return { result, calls, qb };
    };

    it('returns the rows and the unpaginated total', async () => {
      const { result } = await runFindAll();
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('maps a version count instead of loading the version rows', async () => {
      const { calls } = await runFindAll();
      expect(calls.loadRelationCountAndMap).toEqual([
        ['service.versionCount', 'service.versions'],
      ]);
    });

    it('applies no filters when the query is empty', async () => {
      const { calls } = await runFindAll();
      expect(calls.andWhere).toHaveLength(0);
    });

    it('searches name and description case-insensitively', async () => {
      const { calls } = await runFindAll({ search: 'payment' });
      expect(calls.andWhere).toHaveLength(1);
      const [sql, params] = calls.andWhere[0];
      expect(sql).toContain('service.name ILIKE :term');
      expect(sql).toContain('service.description ILIKE :term');
      expect(params).toEqual({ term: '%payment%' });
    });

    it('escapes LIKE wildcards so they match literally', async () => {
      const { calls } = await runFindAll({ search: '100%_off' });
      expect(calls.andWhere[0][1]).toEqual({ term: '%100\\%\\_off%' });
    });

    it('escapes backslashes in the search term', async () => {
      const { calls } = await runFindAll({ search: 'a\\b' });
      expect(calls.andWhere[0][1]).toEqual({ term: '%a\\\\b%' });
    });

    it('filters by type and status independently', async () => {
      const { calls } = await runFindAll({
        type: ServiceType.GRPC,
        status: ServiceStatus.DEPRECATED,
      });
      expect(calls.andWhere).toEqual([
        ['service.type = :type', { type: ServiceType.GRPC }],
        ['service.status = :status', { status: ServiceStatus.DEPRECATED }],
      ]);
    });

    it('sorts by the requested field and direction', async () => {
      const { calls } = await runFindAll({ sort: 'updatedAt', order: 'DESC' });
      expect(calls.orderBy).toEqual([['service.updatedAt', 'DESC']]);
    });

    it('sorts by version count with a correlated subquery, not a column', async () => {
      const { calls } = await runFindAll({
        sort: 'versionCount',
        order: 'DESC',
      });

      const [expression, direction] = calls.orderBy[0];
      // versionCount is resolved by a second query, so there is no column to
      // order by -- it must become a subquery over service_versions.
      expect(expression).toContain('SELECT COUNT(*)');
      expect(expression).toContain('"service_versions"');
      expect(expression).toContain('"vc"."service_id" = "service"."id"');
      expect(expression).not.toContain('service.versionCount');
      expect(direction).toBe('DESC');
    });

    it('keeps the id tiebreaker when sorting by version count', async () => {
      const { calls } = await runFindAll({ sort: 'versionCount' });
      // Ties are common on a count, so the tiebreaker matters most here.
      expect(calls.addOrderBy).toEqual([['service.id', 'ASC']]);
    });

    it('adds a stable id tiebreaker so pages do not shuffle', async () => {
      const { calls } = await runFindAll({ sort: 'name' });
      expect(calls.addOrderBy).toEqual([['service.id', 'ASC']]);
    });

    it('translates page/limit into skip/take', async () => {
      const { calls } = await runFindAll({ page: 3, limit: 25 });
      expect(calls.skip).toEqual([50]);
      expect(calls.take).toEqual([25]);
    });
  });

  describe('findOne', () => {
    it('returns the service with its versions newest first', async () => {
      const expected = buildService();
      serviceRepo.findOne.mockResolvedValue(expected);

      await expect(service.findOne(expected.id)).resolves.toBe(expected);
      expect(serviceRepo.findOne).toHaveBeenCalledWith({
        where: { id: expected.id },
        relations: { versions: true },
        order: { versions: { releasedAt: 'DESC' } },
      });
    });

    it('throws NotFound for an unknown id', async () => {
      serviceRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findVersions', () => {
    it('returns versions newest first', async () => {
      serviceRepo.exist.mockResolvedValue(true);
      versionRepo.find.mockResolvedValue([]);

      await service.findVersions('svc-1');

      expect(versionRepo.find).toHaveBeenCalledWith({
        where: { serviceId: 'svc-1' },
        order: { releasedAt: 'DESC' },
      });
    });

    it('throws NotFound rather than an empty list for an unknown service', async () => {
      serviceRepo.exist.mockResolvedValue(false);

      await expect(service.findVersions('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(versionRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('translates a unique violation into 409 Conflict', async () => {
      // Reachable only via duplicate version names in the payload: service
      // names carry no unique constraint.
      const uniqueViolation = Object.assign(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
        { code: '23505' },
      );
      serviceRepo.save.mockRejectedValue(uniqueViolation);

      await expect(
        service.create({ name: 'Payment Gateway', description: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unrelated database errors untouched', async () => {
      const other = Object.assign(
        new QueryFailedError('INSERT', [], new Error('deadlock')),
        { code: '40P01' },
      );
      serviceRepo.save.mockRejectedValue(other);

      await expect(
        service.create({ name: 'Payment Gateway', description: 'x' }),
      ).rejects.toBe(other);
    });

    it('defaults releasedAt to now when the caller omits it', async () => {
      const saved = buildService();
      serviceRepo.save.mockResolvedValue(saved);
      serviceRepo.findOne.mockResolvedValue(saved);

      await service.create({
        name: 'New',
        description: 'x',
        versions: [{ name: 'v1.0.0' }],
      });

      const created = serviceRepo.create.mock.calls[0][0];
      expect(created.versions[0].releasedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('throws NotFound when preload finds nothing to merge into', async () => {
      serviceRepo.preload.mockResolvedValue(undefined);

      await expect(
        service.update('missing', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(serviceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFound when the delete affected no rows', async () => {
      serviceRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('resolves when a row was deleted', async () => {
      serviceRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove('svc-1')).resolves.toBeUndefined();
    });
  });

  describe('version writes', () => {
    it('scopes version lookups to the parent service', async () => {
      versionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVersion('svc-A', 'version-of-B', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(versionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'version-of-B', serviceId: 'svc-A' },
      });
    });

    it('only assigns the fields present on the patch', async () => {
      const existing = {
        id: 'v1',
        name: 'v1.0.0',
        description: 'keep me',
        changelog: 'keep me too',
        releasedAt: new Date('2024-01-01T00:00:00Z'),
      };
      versionRepo.findOne.mockResolvedValue(existing);
      versionRepo.save.mockImplementation(async (v: any) => v);

      await service.updateVersion('svc-1', 'v1', { name: 'v1.0.1' });

      expect(versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'v1.0.1',
          description: 'keep me',
          changelog: 'keep me too',
        }),
      );
    });
  });
});
