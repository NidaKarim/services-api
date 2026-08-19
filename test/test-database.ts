import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/config/typeorm.config';
import { Service } from '../src/services/entities/service.entity';
import { ServiceVersion } from '../src/services/entities/service-version.entity';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { SEED_SERVICES } from '../src/database/seeds/service.seed-data';
import * as bcrypt from 'bcrypt';

export const TEST_ADMIN = {
  email: 'admin@example.com',
  password: 'password123',
};
export const TEST_VIEWER = {
  email: 'viewer@example.com',
  password: 'password123',
};

/**
 * Applies migrations once per run, so the test schema is built by exactly the
 * same migrations that will run in production.
 */
export async function migrateTestDatabase(): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

/**
 * Resets to a known fixture state. Called before each spec so tests cannot
 * leak state into one another regardless of execution order.
 */
export async function resetTestData(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE "services" RESTART IDENTITY CASCADE');
  await dataSource.query('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');

  const serviceRepo = dataSource.getRepository(Service);
  for (const seed of SEED_SERVICES) {
    await serviceRepo.save(
      serviceRepo.create({
        name: seed.name,
        description: seed.description,
        type: seed.type,
        status: seed.status,
        versions: seed.versions.map((v) =>
          Object.assign(new ServiceVersion(), {
            name: v.name,
            description: v.description,
            changelog: v.changelog,
            releasedAt: new Date(v.releasedAt),
          }),
        ),
      }),
    );
  }

  // Cost factor 4 rather than 10: these hashes only need to be correct, and
  // bcrypt at production cost would dominate the suite runtime.
  const userRepo = dataSource.getRepository(User);
  await userRepo.save([
    userRepo.create({
      email: TEST_ADMIN.email,
      passwordHash: await bcrypt.hash(TEST_ADMIN.password, 4),
      role: UserRole.ADMIN,
    }),
    userRepo.create({
      email: TEST_VIEWER.email,
      passwordHash: await bcrypt.hash(TEST_VIEWER.password, 4),
      role: UserRole.VIEWER,
    }),
  ]);
}
