import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/typeorm.config';

/**
 * Entry point for the TypeORM CLI (migration:generate / migration:run).
 */
export default new DataSource(buildDataSourceOptions());
