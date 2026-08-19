import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Service } from './service.entity';

@Entity({ name: 'service_versions' })
@Unique('uq_service_versions_service_id_name', ['serviceId', 'name'])
export class ServiceVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Semantic version label, e.g. "v1.2.0". Stored as text rather than parsed
   * into major/minor/patch columns — see README trade-offs.
   */
  @Column({ type: 'varchar', length: 40 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true, name: 'changelog' })
  changelog: string | null;

  @Index('idx_service_versions_released_at')
  @Column({ type: 'timestamptz', name: 'released_at' })
  releasedAt: Date;

  @Index('idx_service_versions_service_id')
  @Column({ type: 'uuid', name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Service, (service) => service.versions, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
