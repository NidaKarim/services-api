import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  TEST_ADMIN,
  TEST_VIEWER,
  migrateTestDatabase,
  resetTestData,
} from './test-database';

describe('Services API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let viewerToken: string;

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const asViewer = (req: request.Test) =>
    req.set('Authorization', `Bearer ${viewerToken}`);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api()
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);
    return res.body.accessToken;
  };

  beforeAll(async () => {
    await migrateTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so the suite exercises the real request pipeline.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    // listen(0) rather than init(): with a merely initialised app, supertest
    // performs a listen()/close() cycle for *every* request, and across a suite
    // this size that churn intermittently yields a response with no
    // content-type and no body (observed ~1 in 400). Binding an ephemeral port
    // once means every request reuses the same live server.
    await app.listen(0);

    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetTestData(dataSource);
    adminToken = await login(TEST_ADMIN);
    viewerToken = await login(TEST_VIEWER);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /api/auth/login', () => {
    it('issues a token for valid credentials', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send(TEST_ADMIN)
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email: TEST_ADMIN.email,
        role: 'admin',
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password', () =>
      api()
        .post('/api/auth/login')
        .send({ email: TEST_ADMIN.email, password: 'wrongpassword' })
        .expect(401));

    it('rejects a malformed email', () =>
      api()
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400));
  });

  describe('authorization', () => {
    it('rejects an unauthenticated read', () =>
      api().get('/api/services').expect(401));

    it('rejects a malformed token', () =>
      api()
        .get('/api/services')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401));

    it('lets a viewer read', () =>
      asViewer(api().get('/api/services')).expect(200));

    it('forbids a viewer from writing', () =>
      asViewer(api().post('/api/services'))
        .send({ name: 'Blocked', description: 'should not be created' })
        .expect(403));

    it('lets an admin write', () =>
      asAdmin(api().post('/api/services'))
        .send({ name: 'Allowed', description: 'created by admin' })
        .expect(201));
  });

  describe('GET /api/services', () => {
    it('returns the first page with pagination metadata', async () => {
      const res = await asViewer(api().get('/api/services')).expect(200);

      expect(res.body.meta).toEqual({
        total: 20,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      expect(res.body.data).toHaveLength(20);
    });

    it('returns the fields the card needs', async () => {
      const res = await asViewer(api().get('/api/services?limit=1')).expect(
        200,
      );

      expect(res.body.data[0]).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        type: expect.any(String),
        status: expect.any(String),
        versionCount: expect.any(Number),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('omits the version rows from the list payload', async () => {
      const res = await asViewer(api().get('/api/services')).expect(200);
      expect(res.body.data.every((s: any) => s.versions === undefined)).toBe(
        true,
      );
    });

    it('reports an accurate version count per service', async () => {
      const res = await asViewer(
        api().get('/api/services?search=Payment Gateway'),
      ).expect(200);

      // "Payment Gateway" also appears in another service's description, so
      // select by name rather than assuming the first row.
      const target = res.body.data.find(
        (s: any) => s.name === 'Payment Gateway',
      );
      expect(target.versionCount).toBe(4);
    });

    describe('pagination', () => {
      it('paginates and reports the correct navigation flags', async () => {
        const res = await asViewer(
          api().get('/api/services?page=2&limit=5'),
        ).expect(200);

        expect(res.body.data).toHaveLength(5);
        expect(res.body.meta).toMatchObject({
          total: 20,
          page: 2,
          totalPages: 4,
          hasNextPage: true,
          hasPreviousPage: true,
        });
      });

      it('returns an empty page past the end rather than an error', async () => {
        const res = await asViewer(
          api().get('/api/services?page=99&limit=20'),
        ).expect(200);

        expect(res.body.data).toEqual([]);
        expect(res.body.meta.hasNextPage).toBe(false);
      });

      it('walks every page without duplicating or dropping a service', async () => {
        const seen: string[] = [];
        for (const page of [1, 2, 3, 4]) {
          const res = await asViewer(
            api().get(`/api/services?page=${page}&limit=5`),
          ).expect(200);
          seen.push(...res.body.data.map((s: any) => s.id));
        }

        expect(seen).toHaveLength(20);
        expect(new Set(seen).size).toBe(20);
      });
    });

    describe('search', () => {
      it('matches on name, case-insensitively', async () => {
        const res = await asViewer(
          api().get('/api/services?search=PAYMENT'),
        ).expect(200);

        expect(res.body.data.map((s: any) => s.name)).toContain(
          'Payment Gateway',
        );
      });

      it('matches on description', async () => {
        const res = await asViewer(
          api().get('/api/services?search=tokenizes'),
        ).expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe('Payment Gateway');
      });

      it('returns an empty result set for no matches', async () => {
        const res = await asViewer(
          api().get('/api/services?search=zzzznotathing'),
        ).expect(200);

        expect(res.body.data).toEqual([]);
        expect(res.body.meta.total).toBe(0);
      });

      it('treats LIKE wildcards as literal characters', async () => {
        const res = await asViewer(
          api().get('/api/services?search=%25'),
        ).expect(200);

        // A raw "%" would have matched every row.
        expect(res.body.meta.total).toBe(0);
      });

      it('combines search with pagination consistently', async () => {
        const res = await asViewer(
          api().get('/api/services?search=service&page=1&limit=2'),
        ).expect(200);

        expect(res.body.data.length).toBeLessThanOrEqual(2);
        expect(res.body.meta.total).toBeGreaterThanOrEqual(
          res.body.data.length,
        );
      });
    });

    describe('filtering', () => {
      it('filters by type', async () => {
        const res = await asViewer(api().get('/api/services?type=gRPC')).expect(
          200,
        );

        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data.every((s: any) => s.type === 'gRPC')).toBe(true);
      });

      it('filters by status', async () => {
        const res = await asViewer(
          api().get('/api/services?status=deprecated'),
        ).expect(200);

        expect(res.body.data.every((s: any) => s.status === 'deprecated')).toBe(
          true,
        );
      });

      it('combines filters with search', async () => {
        const res = await asViewer(
          api().get('/api/services?type=REST&status=active&search=a'),
        ).expect(200);

        expect(
          res.body.data.every(
            (s: any) => s.type === 'REST' && s.status === 'active',
          ),
        ).toBe(true);
      });

      it('rejects an unknown type value', () =>
        asViewer(api().get('/api/services?type=CARRIER-PIGEON')).expect(400));
    });

    describe('sorting', () => {
      // Asserted as ASC/DESC symmetry rather than against JS localeCompare:
      // the database sorts by its own collation, and en_US.utf8 and C disagree
      // on names like "SOAP Order Bridge" vs "Search Indexer". Symmetry holds
      // under any collation.
      it('sorts by name ascending by default', async () => {
        const [ascDefault, ascExplicit, desc] = await Promise.all([
          asViewer(api().get('/api/services')).expect(200),
          asViewer(api().get('/api/services?sort=name&order=ASC')).expect(200),
          asViewer(api().get('/api/services?sort=name&order=DESC')).expect(200),
        ]);

        const names = (res: any) => res.body.data.map((s: any) => s.name);

        expect(names(ascDefault)).toEqual(names(ascExplicit));
        expect(names(ascDefault)).toEqual([...names(desc)].reverse());
      });

      it('sorts by name descending', async () => {
        const res = await asViewer(
          api().get('/api/services?sort=name&order=DESC'),
        ).expect(200);
        const names = res.body.data.map((s: any) => s.name);

        // Unambiguous in every collation: 'A' < 'W' on the first character.
        expect(names[0]).toBe('Webhook Dispatcher');
        expect(names[names.length - 1]).toBe('Audit Log');
      });

      it('accepts a lowercase order value', () =>
        asViewer(api().get('/api/services?sort=name&order=desc')).expect(200));

      it('sorts by version count, most versions first', async () => {
        const res = await asViewer(
          api().get('/api/services?sort=versionCount&order=DESC'),
        ).expect(200);

        const counts = res.body.data.map((s: any) => s.versionCount);
        expect(counts).toEqual([...counts].sort((a, b) => b - a));
        expect(counts[0]).toBe(4); // Payment Gateway
      });

      it('sorts by version count ascending', async () => {
        const res = await asViewer(
          api().get('/api/services?sort=versionCount&order=ASC'),
        ).expect(200);

        const counts = res.body.data.map((s: any) => s.versionCount);
        expect(counts).toEqual([...counts].sort((a, b) => a - b));
      });

      it('paginates correctly under a version-count sort', async () => {
        const seen: string[] = [];
        const counts: number[] = [];

        for (const page of [1, 2, 3, 4]) {
          const res = await asViewer(
            api().get(
              `/api/services?sort=versionCount&order=DESC&page=${page}&limit=5`,
            ),
          ).expect(200);
          seen.push(...res.body.data.map((s: any) => s.id));
          counts.push(...res.body.data.map((s: any) => s.versionCount));
        }

        // Ties on a count are common, so this is the case most likely to
        // shuffle across page boundaries without a stable tiebreaker.
        expect(seen).toHaveLength(20);
        expect(new Set(seen).size).toBe(20);
        expect(counts).toEqual([...counts].sort((a, b) => b - a));
      });

      it('rejects a sort field outside the whitelist', () =>
        asViewer(api().get('/api/services?sort=passwordHash')).expect(400));

      it('rejects an invalid order value', () =>
        asViewer(api().get('/api/services?order=SIDEWAYS')).expect(400));
    });

    describe('query validation', () => {
      it('rejects a limit above the ceiling', () =>
        asViewer(api().get('/api/services?limit=1000')).expect(400));

      it('rejects a page below 1', () =>
        asViewer(api().get('/api/services?page=0')).expect(400));

      it('rejects unknown query parameters', () =>
        asViewer(api().get('/api/services?dropTable=1')).expect(400));
    });
  });

  describe('GET /api/services/:id', () => {
    const findPaymentGateway = async () => {
      const res = await asViewer(
        api().get('/api/services?search=Payment Gateway'),
      ).expect(200);
      return res.body.data.find((s: any) => s.name === 'Payment Gateway');
    };

    it('returns the service with its versions inlined, newest first', async () => {
      const target = await findPaymentGateway();
      const res = await asViewer(
        api().get(`/api/services/${target.id}`),
      ).expect(200);

      expect(res.body.name).toBe('Payment Gateway');
      expect(res.body.versions).toHaveLength(4);

      const dates = res.body.versions.map((v: any) =>
        new Date(v.releasedAt).getTime(),
      );
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it('404s for a well-formed but unknown id', () =>
      asViewer(
        api().get('/api/services/00000000-0000-4000-8000-000000000000'),
      ).expect(404));

    it('400s for a malformed id', () =>
      asViewer(api().get('/api/services/not-a-uuid')).expect(400));
  });

  describe('GET /api/services/:id/versions', () => {
    it('returns the versions newest first', async () => {
      const list = await asViewer(
        api().get('/api/services?search=Payment Gateway'),
      ).expect(200);
      const target = list.body.data.find(
        (s: any) => s.name === 'Payment Gateway',
      );

      const res = await asViewer(
        api().get(`/api/services/${target.id}/versions`),
      ).expect(200);

      expect(res.body).toHaveLength(4);
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.anything(),
        changelog: expect.anything(),
        releasedAt: expect.any(String),
      });
    });

    it('404s for an unknown service rather than returning an empty list', () =>
      asViewer(
        api().get(
          '/api/services/00000000-0000-4000-8000-000000000000/versions',
        ),
      ).expect(404));
  });

  describe('write endpoints', () => {
    const newService = {
      name: 'Brand New Service',
      description: 'Created during the e2e run.',
      type: 'GraphQL',
    };

    it('creates a service and makes it retrievable', async () => {
      const created = await asAdmin(api().post('/api/services'))
        .send(newService)
        .expect(201);

      expect(created.body).toMatchObject({
        name: newService.name,
        type: 'GraphQL',
        status: 'active',
        versionCount: 0,
      });

      await asViewer(api().get(`/api/services/${created.body.id}`)).expect(200);
    });

    it('creates initial versions alongside the service', async () => {
      const created = await asAdmin(api().post('/api/services'))
        .send({
          ...newService,
          versions: [
            { name: 'v1.0.0', releasedAt: '2024-01-01T00:00:00Z' },
            { name: 'v1.1.0', releasedAt: '2024-06-01T00:00:00Z' },
          ],
        })
        .expect(201);

      expect(created.body.versionCount).toBe(2);
      expect(created.body.versions.map((v: any) => v.name)).toEqual([
        'v1.1.0',
        'v1.0.0',
      ]);
    });

    it('allows two services to share a name, distinguished by id', async () => {
      // Names are display labels, not identity -- two teams may legitimately
      // own a service with the same name.
      const first = await asAdmin(api().post('/api/services'))
        .send(newService)
        .expect(201);
      const second = await asAdmin(api().post('/api/services'))
        .send(newService)
        .expect(201);

      expect(second.body.id).not.toBe(first.body.id);

      // Both remain independently retrievable by id.
      await asViewer(api().get(`/api/services/${first.body.id}`)).expect(200);
      await asViewer(api().get(`/api/services/${second.body.id}`)).expect(200);
    });

    it('409s when a create payload repeats a version name', () =>
      asAdmin(api().post('/api/services'))
        .send({
          ...newService,
          versions: [{ name: 'v1.0.0' }, { name: 'v1.0.0' }],
        })
        .expect(409));

    it('rejects a create that is missing required fields', () =>
      asAdmin(api().post('/api/services'))
        .send({ name: 'No description' })
        .expect(400));

    it('updates only the supplied fields', async () => {
      const created = await asAdmin(api().post('/api/services'))
        .send(newService)
        .expect(201);

      const updated = await asAdmin(
        api().patch(`/api/services/${created.body.id}`),
      )
        .send({ status: 'deprecated' })
        .expect(200);

      expect(updated.body.status).toBe('deprecated');
      expect(updated.body.name).toBe(newService.name);
      expect(updated.body.description).toBe(newService.description);
    });

    it('404s when updating an unknown service', () =>
      asAdmin(api().patch('/api/services/00000000-0000-4000-8000-000000000000'))
        .send({ status: 'retired' })
        .expect(404));

    it('deletes a service and cascades to its versions', async () => {
      const created = await asAdmin(api().post('/api/services'))
        .send({ ...newService, versions: [{ name: 'v1.0.0' }] })
        .expect(201);

      await asAdmin(api().delete(`/api/services/${created.body.id}`)).expect(
        204,
      );
      await asViewer(api().get(`/api/services/${created.body.id}`)).expect(404);

      const [{ count }] = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM service_versions WHERE service_id = $1',
        [created.body.id],
      );
      expect(count).toBe(0);
    });

    it('404s when deleting a service twice', async () => {
      const created = await asAdmin(api().post('/api/services'))
        .send(newService)
        .expect(201);

      await asAdmin(api().delete(`/api/services/${created.body.id}`)).expect(
        204,
      );
      await asAdmin(api().delete(`/api/services/${created.body.id}`)).expect(
        404,
      );
    });

    describe('versions', () => {
      let serviceId: string;

      beforeEach(async () => {
        const created = await asAdmin(api().post('/api/services'))
          .send(newService)
          .expect(201);
        serviceId = created.body.id;
      });

      it('adds a version', async () => {
        const res = await asAdmin(
          api().post(`/api/services/${serviceId}/versions`),
        )
          .send({ name: 'v1.0.0', changelog: 'First release.' })
          .expect(201);

        expect(res.body).toMatchObject({
          name: 'v1.0.0',
          changelog: 'First release.',
        });
      });

      it('409s on a duplicate version name for the same service', async () => {
        await asAdmin(api().post(`/api/services/${serviceId}/versions`))
          .send({ name: 'v1.0.0' })
          .expect(201);
        await asAdmin(api().post(`/api/services/${serviceId}/versions`))
          .send({ name: 'v1.0.0' })
          .expect(409);
      });

      it('allows the same version name on a different service', async () => {
        const other = await asAdmin(api().post('/api/services'))
          .send({ name: 'Another Service', description: 'x' })
          .expect(201);

        await asAdmin(api().post(`/api/services/${serviceId}/versions`))
          .send({ name: 'v1.0.0' })
          .expect(201);
        await asAdmin(api().post(`/api/services/${other.body.id}/versions`))
          .send({ name: 'v1.0.0' })
          .expect(201);
      });

      it('updates a version', async () => {
        const created = await asAdmin(
          api().post(`/api/services/${serviceId}/versions`),
        )
          .send({ name: 'v1.0.0', description: 'original' })
          .expect(201);

        const updated = await asAdmin(
          api().patch(`/api/services/${serviceId}/versions/${created.body.id}`),
        )
          .send({ description: 'revised' })
          .expect(200);

        expect(updated.body).toMatchObject({
          name: 'v1.0.0',
          description: 'revised',
        });
      });

      it('404s when the version belongs to a different service', async () => {
        const created = await asAdmin(
          api().post(`/api/services/${serviceId}/versions`),
        )
          .send({ name: 'v1.0.0' })
          .expect(201);

        const other = await asAdmin(api().post('/api/services'))
          .send({ name: 'Unrelated Service', description: 'x' })
          .expect(201);

        await asAdmin(
          api().patch(
            `/api/services/${other.body.id}/versions/${created.body.id}`,
          ),
        )
          .send({ name: 'hijacked' })
          .expect(404);
      });

      it('deletes a version and updates the count', async () => {
        const created = await asAdmin(
          api().post(`/api/services/${serviceId}/versions`),
        )
          .send({ name: 'v1.0.0' })
          .expect(201);

        await asAdmin(
          api().delete(
            `/api/services/${serviceId}/versions/${created.body.id}`,
          ),
        ).expect(204);

        const res = await asViewer(
          api().get(`/api/services/${serviceId}`),
        ).expect(200);
        expect(res.body.versionCount).toBe(0);
      });
    });
  });
});
