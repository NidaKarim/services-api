# Services API

A read-and-write API over an organization's service catalog, backing the services dashboard widget: a searchable, paginated list of service cards showing each service's name, description, and available versions.

Built with **Node.js 20 · NestJS 9 · TypeORM 0.3 · PostgreSQL 15 · TypeScript**.

---

## Quick start

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install dependencies
npm install

# 3. Configure the environment
cp .env.example .env      # the defaults already match docker-compose.yml

# 4. Create the schema and load sample data
npm run migration:run
npm run seed

# 5. Run
npm run start:dev
```

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`

The seed creates 20 services with 45 versions between them, plus two accounts:

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `password123` | `admin` — full read/write |
| `viewer@example.com` | `password123` | `viewer` — read-only |

```bash
# Get a token
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@example.com","password":"password123"}'

# Use it
curl http://localhost:3000/api/services?search=payment \
  -H "Authorization: Bearer <accessToken>"
```

---

## API

Every route requires a bearer token except `POST /api/auth/login`. Writes additionally require the `admin` role.

### Auth

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Exchange credentials for a JWT |
| `GET` | `/api/auth/me` | any | The caller identified by the token |

### Services

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/services` | any | List services — search, filter, sort, paginate |
| `GET` | `/api/services/:id` | any | One service, versions inlined |
| `GET` | `/api/services/:id/versions` | any | That service's versions, newest first |
| `POST` | `/api/services` | admin | Create a service (optionally with initial versions) |
| `PATCH` | `/api/services/:id` | admin | Update a service |
| `DELETE` | `/api/services/:id` | admin | Delete a service and its versions |
| `POST` | `/api/services/:id/versions` | admin | Add a version |
| `PATCH` | `/api/services/:id/versions/:versionId` | admin | Update a version |
| `DELETE` | `/api/services/:id/versions/:versionId` | admin | Delete a version |

### `GET /api/services` query parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive substring match on **name and description** |
| `type` | enum | — | `HTTP`, `REST`, `gRPC`, `GraphQL`, `Kafka`, `WebSocket` |
| `status` | enum | — | `active`, `deprecated`, `retired` |
| `sort` | enum | `name` | `name`, `createdAt`, `updatedAt`, `versionCount` |
| `order` | enum | `ASC` | `ASC`, `DESC` (case-insensitive) |
| `page` | int ≥ 1 | `1` | |
| `limit` | int 1–100 | `20` | Hard ceiling of 100 |

Unknown parameters are rejected with `400` rather than silently ignored.

**Response**

```jsonc
{
  "data": [
    {
      "id": "8a796890-e893-42f4-8af7-21c531efe242",
      "name": "Payment Gateway",
      "description": "Tokenizes cards and brokers authorizations, captures, and refunds.",
      "type": "REST",
      "status": "active",
      "versionCount": 4,          // what the card's version badge renders
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 20, "page": 1, "limit": 20,
    "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false
  }
}
```

### Status codes

| Code | When |
|---|---|
| `400` | Validation failure — bad enum, out-of-range page/limit, malformed UUID, unknown query param |
| `401` | Missing, malformed, or expired token |
| `403` | Authenticated but lacking the required role |
| `404` | No such service or version (including a version that belongs to a different service) |
| `409` | Duplicate version name within a service |

---

## Data model

```
┌─────────────────────────┐          ┌──────────────────────────────┐
│ services                │          │ service_versions             │
├─────────────────────────┤          ├──────────────────────────────┤
│ id           uuid  PK   │──┐       │ id           uuid  PK        │
│ name         varchar(120)│  │       │ service_id   uuid  FK ───────┼─┐
│              (not unique)│  └──1:N─▶│ name         varchar(40)     │ │
│ description  text        │          │ description  text NULL       │ │
│ type         enum        │          │ changelog    text NULL       │ │
│ status       enum        │          │ released_at  timestamptz     │ │
│ created_at   timestamptz │          │ created_at   timestamptz     │ │
│ updated_at   timestamptz │          │ UNIQUE (service_id, name)    │ │
└─────────────────────────┘          └──────────────────────────────┘ │
             ▲                                ON DELETE CASCADE ──────┘

┌─────────────────────────┐
│ users                   │
├─────────────────────────┤
│ id            uuid  PK  │
│ email         varchar UNIQUE │
│ password_hash varchar (select: false) │
│ role          enum (viewer | admin)   │
└─────────────────────────┘
```

Two entities carry the story. A **service** is the catalog record the card renders; a **service version** is one released iteration of it. The relationship is one-to-many with `ON DELETE CASCADE`, so deleting a service cannot orphan version rows.

**Identity is the `id` column, never the name.** `services.name` carries no unique constraint: a name is a display label, and two teams can legitimately own services that share one. The foreign key from `service_versions` references `services(id)`, and every route addresses a service by uuid, so a rename is a pure display change that breaks no reference. Version names *are* unique, but only within their parent service — `UNIQUE (service_id, name)` — so two different services can each publish a `v1.0.0`.

**Indexes:** `services.name` (search + default sort), `services.status` (filter), `services.updated_at` (sort), `service_versions.service_id` (the join and the count), `service_versions.released_at` (version ordering).

---

## Design considerations

### `versionCount` is computed, not stored

The card needs "N versions" but not the version rows. Loading the full `versions` relation for every service on every list request would be the classic N+1 — 20 cards, 20 extra queries, all to produce a number.

Instead the list query uses TypeORM's `loadRelationCountAndMap`, which folds the count into the query as an aggregate. The list payload carries `versionCount` and omits `versions` entirely; the detail endpoint (`GET /services/:id`), where the client actually wants them, inlines the full list.

The alternative — a denormalized `version_count` column on `services` — is faster still but has to be kept correct through every version insert and delete. Not worth the consistency risk at this scale.

### Search is `ILIKE` over name and description

`ILIKE '%term%'` is predictable, needs no extra schema, and is what a dashboard search box actually means. Postgres full-text search would bring stemming and ranking, but stemming is actively unhelpful on short proper nouns like service names — a search for "Payments" should find "Payment Gateway", and FTS relevance ranking on a 20-row catalog buys nothing.

The trade-off is that a leading-wildcard `ILIKE` cannot use a plain B-tree index and degrades to a sequential scan. At catalog scale (hundreds to low thousands of services) that is genuinely fine. Past that, the migration path is a `pg_trgm` GIN index on `name` and `description`, which makes `ILIKE '%term%'` index-accelerated without changing a line of application code. See *Next steps*.

User input is escaped for `%`, `_`, and `\` before interpolation, with `ESCAPE '\'` on the query — otherwise a search for `50%` would silently match every row.

### Sorting is whitelist-only

Column names cannot be parameterized in SQL, so `sort` is interpolated into the query. It is validated against a closed `SERVICE_SORT_FIELDS` tuple by `@IsIn`, and that tuple is the same value the Swagger enum is generated from — the validation and the documentation cannot drift apart.

Every sort gets `service.id ASC` appended as a tiebreaker. Without it, rows with equal sort keys have no guaranteed order between queries, and a user paging through the list can see the same service twice or miss one entirely.

`sort=versionCount` is the interesting case. `versionCount` is not a column — `loadRelationCountAndMap` resolves it in a *second* query, which the database cannot then sort by. So that sort switches to a correlated subquery over `service_versions`, which gives the planner something to order on while keeping the main query join-free, so `LIMIT`/`OFFSET` stay plain and pagination is unaffected. It is also the sort where ties are most common — a dozen services with two versions each — which is exactly where the id tiebreaker earns its place; there is an e2e test that pages through the whole catalog under this sort and asserts no service is duplicated or dropped.

### Offset pagination

`page`/`limit` with a `total` count. The mockup shows a numbered pager, which needs a total and random page access — both of which cursor pagination gives up. Offset pagination's weakness is deep pages (`OFFSET 10000` still scans and discards 10,000 rows) and drift when rows are inserted mid-pagination, neither of which bites a catalog this size.

`limit` is capped at 100 so a client cannot request the entire table in one call.

### Entities are never returned directly

Controllers return explicit response DTOs built by `fromEntity` mappers. This keeps the wire format decoupled from the schema — a column can be renamed without breaking clients — and makes it structurally impossible to leak a field by adding it to an entity. `password_hash` is additionally marked `select: false` so it is not even loaded unless explicitly requested.

### Secure by default

`JwtAuthGuard` is registered globally via `APP_GUARD`, so a new route is authenticated unless it opts out with `@Public()`. The inverse — remembering to add a guard to each route — fails open, and the failure is silent.

`RolesGuard` is registered second so it runs after `request.user` is populated. A route with no `@Roles()` requires only authentication; `@Roles(UserRole.ADMIN)` narrows it further.

The JWT strategy re-reads the user from the database on every request rather than trusting the token's claims, so a deleted user or a demoted role takes effect immediately instead of lingering until the token expires. That is one indexed primary-key lookup per request — cheap, and worth it.

### Conflicts are detected by the database

Duplicate version names within a service are caught by the `UNIQUE (service_id, name)` constraint and translated to `409`, not by a read-then-write existence check. A check-then-insert is a race: two concurrent requests both read "no conflict", then both insert. The constraint is the only authority that cannot be raced.

### Migrations, never `synchronize`

`synchronize: true` is convenient and will eventually drop a column in production. Schema changes go through generated, reviewable, reversible migrations. The e2e suite builds its schema by running those same migrations, so the migration path itself is exercised on every test run.

---

## Assumptions

1. **Single organization.** The story says "services in my organization", but nothing in the requirements distinguishes between organizations. There is no `organization_id` and no tenant scoping. Adding it later means a column, a composite index, and a scoping clause in the query builder — see *Next steps*.
2. **Versions are labels, not parsed semver.** Stored as `varchar(40)` and ordered by `released_at`, not by parsed major/minor/patch. Release date is what the UI displays and is unambiguous; parsing semver would mean handling pre-release tags, build metadata, and non-conforming labels for no gain the story asks for.
3. **"Navigate to a given service" means fetch by id.** The card links to a detail view; `GET /services/:id` is what backs it. UUID primary keys are exposed directly rather than slugs, since names are user-editable and a changing URL breaks bookmarks.
4. **Deletion is hard deletion.** The `status` enum (`active`/`deprecated`/`retired`) covers the realistic "remove it from the dashboard" case without destroying history, so a `DELETE` is taken at face value.
5. **Users are seeded, not self-registered.** The story is about the catalog, not user management. There is no signup endpoint — accounts come from the seed. Real deployments would source identity from the organization's SSO.
6. **The `search` box searches descriptions too.** Searching "payment" returns *Legacy Billing*, whose description mentions Payment Gateway. This is intentional — description matches are how a user finds a service whose exact name they do not remember.

---

## Trade-offs

| Decision | Chosen | Given up |
|---|---|---|
| Version count | `loadRelationCountAndMap` | A stored counter would be marginally faster, but needs maintaining on every write |
| Search | `ILIKE` on two columns | FTS ranking and stemming; index-backed matching until `pg_trgm` is added |
| Pagination | Offset (`page`/`limit`) | Cursor stability on deep pages — but gains `total` and random page access |
| Deletion | Hard delete + `status` enum | An `deleted_at` soft-delete column and restore capability |
| Tenancy | Single-tenant | Multi-org isolation, deferred rather than half-built |
| Auth | JWT, stateless | Immediate revocation — mitigated by re-reading the user each request, but a revoked token is valid until expiry |
| Version ordering | By `released_at` | Semver-aware sorting |
| Config | Env vars validated by Joi at boot | Runtime reconfiguration |

---

## Testing

```bash
npm test               # unit — 41 tests, no database required
npm run test:e2e       # integration — 55 tests against a real Postgres
npm run test:cov       # coverage
```

**Unit tests** (`*.spec.ts` beside the source) run against mocked repositories and cover the logic worth isolating: which SQL fragments and parameters the query builder receives for each filter combination, LIKE-wildcard escaping, the stable sort tiebreaker, the version-count sort becoming a subquery rather than a column reference, skip/take arithmetic, the unique-violation → `409` translation (and that unrelated database errors are *not* swallowed), partial-patch semantics, role-guard decisions, and that login gives identical errors for "unknown email" and "wrong password".

**E2E tests** (`test/services.e2e-spec.ts`) boot the real Nest application against a dedicated `services_test` database, built by running the actual migrations. Each spec starts from a truncate-and-reseed, so tests cannot leak state into one another. They cover the full request pipeline — validation, guards, serialization — including the auth gate, viewer-vs-admin authorization, pagination arithmetic (walking all four pages and asserting no service is duplicated or dropped), search on name and on description, wildcard escaping, filter combinations, sort whitelist rejection, the complete CRUD lifecycle, cascade deletion verified directly in the database, cross-service version scoping, and that two services may share a name while remaining distinct by id.

The e2e suite requires the `services_test` database, created once with:

```bash
npm run db:test:create
```

Connection settings come from `.env.test`, which overrides `.env` so the suite can never touch the development database.

One detail worth calling out, because it cost me a real debugging session: the suite binds the app with `app.listen(0)` rather than the more common `app.init()`. With a merely initialised app, supertest performs a `listen()`/`close()` cycle for *every* request — hundreds of them across a suite this size — and that churn intermittently produced a response with no content-type and no body, which surfaced as a spurious `404` in roughly 1 run in 12. It presented as a flaky assertion in whichever test happened to draw the short straw, which is exactly what makes this class of bug expensive: the failure appears in unrelated tests each time. Binding an ephemeral port once removes the churn.

---

## Project layout

```
src/
├── auth/                    JWT auth, guards, roles
│   ├── decorators/          @Public, @Roles, @CurrentUser
│   ├── guards/              JwtAuthGuard (global), RolesGuard (global)
│   └── strategies/          Passport JWT strategy
├── common/dto/              Pagination query + paginated response envelope
├── config/                  Env validation (Joi), TypeORM options
├── database/
│   ├── migrations/          Generated, reviewable schema changes
│   └── seeds/               Sample catalog + demo users
└── services/                The catalog module
    ├── dto/                 Query, create, update, response DTOs
    └── entities/            Service, ServiceVersion
```

---

## Next steps

Things deliberately left out, in the order I would add them:

1. **Trigram index for search.** `CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (name gin_trgm_ops)` makes the existing `ILIKE` queries index-backed with no application change.
2. **Multi-tenancy.** An `organization_id` on `services`, scoped from the JWT claims in a single place in the query builder.
3. **Structured logging and request tracing.** Correlation ids through to the query logs.
4. **Refresh tokens and revocation.** Short-lived access tokens plus a rotating refresh token, and a denylist for immediate revocation.
5. **Rate limiting.** `@nestjs/throttler` on the login route in particular.
6. **CI.** Lint, unit, and e2e against a Postgres service container on every pull request.
