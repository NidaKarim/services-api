import { DataSourceOptions } from 'typeorm';
import { join } from 'path';

/**
 * Single source of truth for connection options, shared by the Nest module and
 * the TypeORM CLI (see src/database/data-source.ts) so migrations always run
 * against the same schema the app expects.
 */
export const buildDataSourceOptions = (
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions => ({
  type: 'postgres',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT ?? '5432', 10),
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  // Never true: schema changes go through explicit, reviewable migrations.
  synchronize: false,
  logging: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
