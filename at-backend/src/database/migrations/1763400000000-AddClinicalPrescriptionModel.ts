import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalPrescriptionModel1763400000000 implements MigrationInterface {
  name = 'AddClinicalPrescriptionModel1763400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
      ADD COLUMN IF NOT EXISTS "recurrenceType" character varying(30) NOT NULL DEFAULT 'DAILY',
      ADD COLUMN IF NOT EXISTS "doseValue" character varying(50),
      ADD COLUMN IF NOT EXISTS "doseUnit" character varying(30),
      ADD COLUMN IF NOT EXISTS "perDoseOverrides" text,
      ADD COLUMN IF NOT EXISTS "alternateDaysInterval" integer,
      ADD COLUMN IF NOT EXISTS "monthlyDay" integer,
      ADD COLUMN IF NOT EXISTS "prnReason" character varying(20)
    `);

    await queryRunner.query(`
      UPDATE "prescription_items"
      SET "recurrenceType" = CASE
        WHEN "crisisOnly" = true OR "feverOnly" = true OR "painOnly" = true THEN 'PRN'
        WHEN "monthlyRule" IS NOT NULL THEN 'MONTHLY'
        WHEN "weeklyDay" IS NOT NULL THEN 'WEEKLY'
        ELSE 'DAILY'
      END
      WHERE "recurrenceType" IS NULL OR "recurrenceType" = 'DAILY'
    `);

    await queryRunner.query(`
      UPDATE "prescription_items"
      SET "prnReason" = CASE
        WHEN "crisisOnly" = true THEN 'CRISIS'
        WHEN "feverOnly" = true THEN 'FEVER'
        WHEN "painOnly" = true THEN 'PAIN'
        ELSE NULL
      END
      WHERE "prnReason" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "prescription_items"
      SET "doseValue" = "doseAmount"
      WHERE "doseValue" IS NULL AND "doseAmount" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
      DROP COLUMN IF EXISTS "prnReason",
      DROP COLUMN IF EXISTS "monthlyDay",
      DROP COLUMN IF EXISTS "alternateDaysInterval",
      DROP COLUMN IF EXISTS "perDoseOverrides",
      DROP COLUMN IF EXISTS "doseUnit",
      DROP COLUMN IF EXISTS "doseValue",
      DROP COLUMN IF EXISTS "recurrenceType"
    `);
  }
}
