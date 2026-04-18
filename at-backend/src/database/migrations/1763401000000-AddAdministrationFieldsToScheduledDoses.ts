import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdministrationFieldsToScheduledDoses1763401000000 implements MigrationInterface {
  name = 'AddAdministrationFieldsToScheduledDoses1763401000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "administrationValue" character varying(50),
      ADD COLUMN IF NOT EXISTS "administrationUnit" character varying(30),
      ADD COLUMN IF NOT EXISTS "administrationLabel" character varying(100)
    `);

    await queryRunner.query(`
      UPDATE "scheduled_doses" sd
      SET
        "administrationValue" = COALESCE(sd."administrationValue", pi."doseValue"),
        "administrationUnit" = COALESCE(sd."administrationUnit", pi."doseUnit"),
        "administrationLabel" = COALESCE(
          sd."administrationLabel",
          CASE
            WHEN pi."doseValue" IS NOT NULL AND pi."doseUnit" IS NOT NULL THEN pi."doseValue" || ' ' || pi."doseUnit"
            WHEN pi."doseValue" IS NOT NULL THEN pi."doseValue"
            WHEN pi."doseAmount" IS NOT NULL THEN pi."doseAmount"
            ELSE sd."doseLabel"
          END
        )
      FROM "prescription_items" pi
      WHERE sd."prescriptionItemId" = pi."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "administrationLabel",
      DROP COLUMN IF EXISTS "administrationUnit",
      DROP COLUMN IF EXISTS "administrationValue"
    `);
  }
}
