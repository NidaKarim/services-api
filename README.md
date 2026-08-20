# Services API

A read-and-write API over an organization's service catalog, backing the services dashboard widget: a searchable, paginated list of service cards showing each service's name, description, and available versions.

Built with **Node.js 20 · NestJS 9 · TypeORM 0.3 · PostgreSQL 15 · TypeScript**.

Most of the interesting code is in [`services.service.ts`](src/services/services.service.ts) (the query builder) and the [Design considerations](#design-considerations) section below, which explains why it looks the way it does.

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

Only two entities. A service is the record the card renders, a version is one release of it. One-to-many, with `ON DELETE CASCADE` on the foreign key so deleting a service can't leave orphaned version rows behind.

Identity is the `id`, never the name. I originally put a unique constraint on `services.name` and then took it off: a name is a display label, and two teams can reasonably own services called the same thing. Everything references services by uuid, so renaming one breaks nothing.

Version names are unique, but only inside their own service (`UNIQUE (service_id, name)`). So two services can both ship a `v1.0.0`, but one service can't ship it twice.

Indexed: `services.name` (search and the default sort), `services.status` (filter), `services.updated_at` (sort), `service_versions.service_id` (the join and the count), `service_versions.released_at` (version ordering).

---

## Design considerations

### `versionCount` is computed, not stored

The card needs the number "4 versions", not the four rows. Loading the `versions` relation for every service in the list is the classic N+1: 20 cards, 20 extra queries, all to produce 20 integers.

So the list query uses `loadRelationCountAndMap` and gets the count as an aggregate. The list response carries `versionCount` and leaves `versions` out entirely. The detail endpoint inlines the full list, because that's where you actually want them.

I considered a denormalized `version_count` column. It's faster, but it has to be kept correct on every version insert and delete, and if any path misses it the UI starts showing a number that isn't true. Not worth it at this size.

### Search is `ILIKE` over name and description

`ILIKE '%term%'` across both columns. It's predictable, needs no extra schema, and it's what people expect a search box to do.

I looked at Postgres full-text search and decided against it. Stemming doesn't help on short proper nouns like service names, and relevance ranking over 20 rows isn't buying anything. The cost of the simple approach is that a leading wildcard can't use a B-tree index, so this is a sequential scan. Fine for a catalog of this size; if it grew, a `pg_trgm` GIN index makes the same queries index-backed without touching the application code.

Search terms get escaped for `%`, `_` and `\` before they go into the query, with `ESCAPE '\'`. Without that, searching for `50%` quietly returns every row.

### Sorting is whitelist-only

You can't parameterize a column name in SQL, so `sort` has to be interpolated. It's validated against a closed `SERVICE_SORT_FIELDS` tuple with `@IsIn`, and the Swagger enum is generated from that same tuple, so the docs and the validation can't drift.

Every sort also gets `service.id ASC` appended. Rows with equal sort keys have no guaranteed order otherwise, and since each page is a separate query, a user paging through can see the same service twice or miss one completely. No error, nothing in the logs.

`sort=versionCount` is the awkward one. It isn't a column, and `loadRelationCountAndMap` resolves it in a second query that the database can't then sort by. That sort uses a correlated subquery over `service_versions` instead, which keeps the main query join-free so `LIMIT`/`OFFSET` stay simple. It's also where ties are most common (a dozen services with two versions each), so it's the case the id tiebreaker matters most for.

### Offset pagination

`page` and `limit`, with a `total` in the response. The mockup has a numbered pager, and that needs a total and the ability to jump to a page, both of which cursor pagination gives up.

Offset paging is weak on deep pages (`OFFSET 10000` still scans and throws away 10,000 rows) and drifts if rows are inserted while you're paging. Neither matters for a service catalog. If this were an activity feed I'd have gone the other way.

`limit` is capped at 100 so nobody can pull the whole table in one request.

### Entities are never returned directly

Controllers return response DTOs built by `fromEntity` mappers, never entities. That keeps the wire format independent of the schema, and it means adding a column to an entity can't accidentally publish it. `password_hash` also has `select: false`, so it isn't even loaded unless a query asks for it by name.

### Secure by default

`JwtAuthGuard` is registered globally through `APP_GUARD`, so every route is authenticated unless it opts out with `@Public()`. Only the login route does. Doing it the other way round, adding a guard per route, fails open when you forget one, and it fails silently.

`RolesGuard` is registered second because it reads `request.user`, which only exists once the first guard has run. Order matters there.

The JWT strategy re-reads the user from the database on each request instead of trusting the token claims. It's an extra primary-key lookup, but it means deleting a user or changing their role takes effect on the next request rather than whenever their token happens to expire. A stolen token is still valid until expiry; fixing that properly needs refresh tokens and a denylist.

### Conflicts are detected by the database

Duplicate version names come back as `409`, but the check isn't a `findOne` before the insert. Read-then-write is a race: two concurrent requests both see no conflict, then both insert. So the insert just runs and a Postgres `23505` gets translated into a `409`. The handler matches that specific code, so an unrelated database failure still surfaces as a 500 rather than being mislabelled a conflict.

### Migrations, never `synchronize`

`synchronize: true` is convenient right up until it infers a `DROP COLUMN` from a renamed property. Everything goes through migrations instead, which show up in a diff and can be reverted. The e2e suite builds its schema by running those same migrations, so the migration path gets exercised on every test run.

---

## Assumptions

Things I decided rather than asked about:

1. **Single organization.** The story says "services in my organization" but nothing else in the requirements distinguishes one org from another, so there's no `organization_id` and no tenant scoping. Adding it later is a column, a composite index, and one scoping clause in the query builder.
2. **Version names are labels, not parsed semver.** Stored as text and ordered by `released_at`. The release date is what the UI shows and it's unambiguous. Parsing semver means dealing with pre-release tags, build metadata and labels that don't conform, and nothing in the story needs it.
3. **"Navigate to a given service" means fetch it by id.** The card links to a detail view and `GET /services/:id` backs it. I'm exposing uuids rather than slugs, since names are editable and a URL that changes when you rename something breaks bookmarks.
4. **Delete means delete.** The `status` enum covers the "get it off the dashboard but keep the history" case, so if someone actually calls `DELETE` I take them at their word.
5. **Users are seeded, not self-registered.** The story is about the catalog, not user management, so there's no signup endpoint. In a real deployment this would come from SSO.
6. **Search covers descriptions, not just names.** Searching "payment" also returns *Legacy Billing*, because its description mentions Payment Gateway. That's deliberate: description matches are how you find a service when you can't remember what it's called.

---

## Trade-offs

| Decision | Chosen | Given up |
|---|---|---|
| Version count | Aggregate via `loadRelationCountAndMap` | A stored counter, which would be faster but needs maintaining on every write |
| Search | `ILIKE` on two columns | FTS ranking and stemming; index-backed matching until `pg_trgm` is added |
| Pagination | Offset (`page`/`limit`) | Cursor stability on deep pages, in exchange for a `total` and jumping to any page |
| Deletion | Hard delete plus a `status` enum | A `deleted_at` soft-delete column and the ability to restore |
| Tenancy | Single-tenant | Multi-org isolation. Left out rather than half-built |
| Auth | Stateless JWT | Immediate revocation. Re-reading the user each request covers deletion and role changes, but a stolen token lives until it expires |
| Version ordering | By `released_at` | Semver-aware sorting |
| Config | Env vars validated by Joi at boot | Runtime reconfiguration |

---

## Testing

```bash
npm test               # unit, no database needed
npm run db:test:create # once
npm run test:e2e       # integration, needs Postgres
```

41 unit tests and 55 e2e. The unit tests mock the repositories so they run without a database, mostly checking that the query builder gets handed the right SQL fragments and parameters. The e2e suite boots the real app against a separate `services_test` database and truncates and reseeds before each spec, so nothing leaks between tests. Connection settings come from `.env.test`, which overrides `.env`.

Scenarios covered:

- **Auth**: valid login, wrong password, unknown email, missing token, malformed token
- **Authorization**: viewer can read, viewer blocked on every write route, admin allowed
- **Search**: matches on name, matches on description, no results, `%` and `_` treated as literal characters
- **Filters**: by type, by status, combined with search
- **Sorting**: each sortable field, both directions, anything outside the whitelist rejected
- **Pagination**: page arithmetic and flags, empty page past the end, walking every page with no service duplicated or dropped
- **Detail**: versions inlined newest first, 404 on an unknown id, 400 on a malformed one
- **CRUD**: create with nested versions, partial update leaving other fields alone, delete cascading to versions (verified in the database, not just through the API)
- **Conflicts**: same version name twice on one service rejected, same name on a different service allowed
- **Scoping**: editing a version through the wrong service's URL returns 404
- **Names**: two services can share a name and stay distinct by id

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
