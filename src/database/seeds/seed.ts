import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../config/typeorm.config';
import { Service } from '../../services/entities/service.entity';
import { ServiceVersion } from '../../services/entities/service-version.entity';
import { SEED_SERVICES } from './service.seed-data';

async function seedServices(dataSource: DataSource): Promise<void> {
  // CASCADE also clears service_versions via the FK.
  await dataSource.query('TRUNCATE TABLE "services" RESTART IDENTITY CASCADE');

  const serviceRepo = dataSource.getRepository(Service);

  for (const seedService of SEED_SERVICES) {
    const service = serviceRepo.create({
      name: seedService.name,
      description: seedService.description,
      type: seedService.type,
      status: seedService.status,
      versions: seedService.versions.map((v) =>
        Object.assign(new ServiceVersion(), {
          name: v.name,
          description: v.description,
          changelog: v.changelog,
          releasedAt: new Date(v.releasedAt),
        }),
      ),
    });
    await serviceRepo.save(service);
  }
}

/**
 * Idempotent seed: truncating first means `npm run seed` always lands on the
 * same known state, which the e2e suite relies on.
 */
async function seed(): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();

  try {
    await seedServices(dataSource);

    const [{ count: serviceCount }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM services',
    );
    const [{ count: versionCount }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM service_versions',
    );
    console.log(
      `Seeded ${serviceCount} services and ${versionCount} versions.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
