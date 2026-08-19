import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceVersion } from './service-version.entity';

/**
 * The protocol/interface a service exposes. Drives the icon shown on the card.
 */
export enum ServiceType {
  HTTP = 'HTTP',
  REST = 'REST',
  GRPC = 'gRPC',
  GRAPHQL = 'GraphQL',
  KAFKA = 'Kafka',
  WEBSOCKET = 'WebSocket',
}

/**
 * Lifecycle state. Lets the dashboard filter out retired services by default
 * without hard-deleting rows.
 */
export enum ServiceStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  RETIRED = 'retired',
}

@Entity({ name: 'services' })
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Deliberately not unique: two teams can legitimately own services with the
   * same display name, and `id` is the only identity that matters. Indexed for
   * the search and default-sort paths.
   */
  @Index('idx_services_name')
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.REST,
  })
  type: ServiceType;

  @Index('idx_services_status')
  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.ACTIVE,
  })
  status: ServiceStatus;

  @OneToMany(() => ServiceVersion, (version) => version.service, {
    cascade: ['insert'],
  })
  versions: ServiceVersion[];

  /**
   * Populated by `loadRelationCountAndMap` on list queries so the card can
   * render "N versions" without hydrating the whole versions collection.
   * Not a real column.
   */
  versionCount?: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Index('idx_services_updated_at')
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
