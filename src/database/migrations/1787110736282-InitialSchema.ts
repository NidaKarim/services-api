import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787110736282 implements MigrationInterface {
  name = 'InitialSchema1787110736282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "service_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(40) NOT NULL, "description" text, "changelog" text, "released_at" TIMESTAMP WITH TIME ZONE NOT NULL, "service_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_service_versions_service_id_name" UNIQUE ("service_id", "name"), CONSTRAINT "PK_2cdf123a2486f00862495e81101" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_service_versions_released_at" ON "service_versions" ("released_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_service_versions_service_id" ON "service_versions" ("service_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."services_type_enum" AS ENUM('HTTP', 'REST', 'gRPC', 'GraphQL', 'Kafka', 'WebSocket')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."services_status_enum" AS ENUM('active', 'deprecated', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "description" text NOT NULL, "type" "public"."services_type_enum" NOT NULL DEFAULT 'REST', "status" "public"."services_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_services_name" ON "services" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_services_status" ON "services" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_services_updated_at" ON "services" ("updated_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "service_versions" ADD CONSTRAINT "FK_f5450adbc27ad1d21ac39ccd344" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_versions" DROP CONSTRAINT "FK_f5450adbc27ad1d21ac39ccd344"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_services_updated_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_services_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_services_name"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TYPE "public"."services_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."services_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_service_versions_service_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_service_versions_released_at"`,
    );
    await queryRunner.query(`DROP TABLE "service_versions"`);
  }
}
