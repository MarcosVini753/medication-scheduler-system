import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddCreatedAtToPatientRoutines1763405000000 } from '../src/database/migrations/1763405000000-AddCreatedAtToPatientRoutines';

describe('AddCreatedAtToPatientRoutines1763405000000', () => {
  it('drops the old index before deduplicating and recreates it afterwards', async () => {
    const migration = new AddCreatedAtToPatientRoutines1763405000000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      })
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(executedQueries).toHaveLength(5);
    expect(executedQueries[0]).toContain('ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()');
    expect(executedQueries[1]).toContain('SET "createdAt" = NOW()');
    expect(executedQueries[2]).toContain('DROP INDEX IF EXISTS "IDX_patient_routines_single_active"');
    expect(executedQueries[3]).toContain('ORDER BY "createdAt" DESC, id DESC');
    expect(executedQueries[4]).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patient_routines_single_active"');
  });

  it('drops the recreated index before removing createdAt on down', async () => {
    const migration = new AddCreatedAtToPatientRoutines1763405000000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      })
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(executedQueries).toEqual([
      expect.stringContaining('DROP INDEX IF EXISTS "IDX_patient_routines_single_active"'),
      expect.stringContaining('DROP COLUMN IF EXISTS "createdAt"')
    ]);
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
