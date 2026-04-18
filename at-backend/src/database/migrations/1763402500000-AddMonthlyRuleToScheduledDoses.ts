import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonthlyRuleToScheduledDoses1763402500000
  implements MigrationInterface
{
  name = 'AddMonthlyRuleToScheduledDoses1763402500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "monthlyRule" character varying
    `);

    await queryRunner.query(`
      UPDATE "scheduled_doses" sd
      SET "monthlyRule" = COALESCE(sd."monthlyRule", pi."monthlyRule")
      FROM "prescription_items" pi
      WHERE sd."prescriptionItemId" = pi."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "monthlyRule"
    `);
  }
}
