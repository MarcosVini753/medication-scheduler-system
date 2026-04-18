import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurrenceMetadataToScheduledDoses1763402000000 implements MigrationInterface {
  name = 'AddRecurrenceMetadataToScheduledDoses1763402000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "recurrenceType" character varying(30),
      ADD COLUMN IF NOT EXISTS "startDate" date,
      ADD COLUMN IF NOT EXISTS "endDate" date,
      ADD COLUMN IF NOT EXISTS "weeklyDay" character varying,
      ADD COLUMN IF NOT EXISTS "monthlyDay" integer,
      ADD COLUMN IF NOT EXISTS "alternateDaysInterval" integer,
      ADD COLUMN IF NOT EXISTS "continuousUse" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "prnReason" character varying(20)
    `);

    await queryRunner.query(`
      UPDATE "scheduled_doses" sd
      SET
        "recurrenceType" = COALESCE(sd."recurrenceType", pi."recurrenceType"),
        "startDate" = COALESCE(sd."startDate", p."startedAt"),
        "endDate" = COALESCE(
          sd."endDate",
          CASE
            WHEN pi."continuousUse" = true OR pi."treatmentDays" IS NULL OR pi."treatmentDays" <= 0 THEN NULL
            ELSE p."startedAt" + ((pi."treatmentDays" - 1) * INTERVAL '1 day')
          END
        ),
        "weeklyDay" = COALESCE(sd."weeklyDay", pi."weeklyDay"),
        "monthlyDay" = COALESCE(sd."monthlyDay", pi."monthlyDay"),
        "alternateDaysInterval" = COALESCE(sd."alternateDaysInterval", pi."alternateDaysInterval"),
        "continuousUse" = pi."continuousUse",
        "prnReason" = COALESCE(sd."prnReason", pi."prnReason")
      FROM "prescription_items" pi, "prescriptions" p
      WHERE sd."prescriptionItemId" = pi."id"
        AND p."id" = sd."prescriptionId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "prnReason",
      DROP COLUMN IF EXISTS "continuousUse",
      DROP COLUMN IF EXISTS "alternateDaysInterval",
      DROP COLUMN IF EXISTS "monthlyDay",
      DROP COLUMN IF EXISTS "weeklyDay",
      DROP COLUMN IF EXISTS "endDate",
      DROP COLUMN IF EXISTS "startDate",
      DROP COLUMN IF EXISTS "recurrenceType"
    `);
  }
}
