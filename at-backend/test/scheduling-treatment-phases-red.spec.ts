import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  buildItem,
  buildPrescription,
  buildScheduleResult,
  buildRoutine,
  createSchedulingService,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService phased treatments from PDF (red specs)', () => {
  it('should expose four CONTRAVE phases with chained dates, frequencies and per-dose values', async () => {
    const { service } = createSchedulingService({
      routine: buildRoutine({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '13:00',
        lanche: '16:00',
        jantar: '19:00',
        dormir: '21:00',
      }),
    });

    const contraveCurrentModelItem = buildItem({
      frequency: 1,
      doseAmount: '1 COMP',
      doseValue: '1',
      doseUnit: DoseUnit.COMP,
      treatmentDays: 7,
      medication: {
        commercialName: 'CONTRAVE',
        activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
        presentation: 'Comprimido revestido de liberacao prolongada',
        administrationRoute: 'VIA ORAL',
        usageInstructions:
          'Utilizar junto com as refeicoes e ajustar a posologia ao longo das semanas.',
      },
      group: {
        code: GroupCode.GROUP_III,
        name: 'Grupo III',
      },
    });

    const prescriptionWithTargetPhaseMetadata = {
      ...buildPrescription([contraveCurrentModelItem], {
        startedAt: '2026-02-20',
      }),
      phases: [
        {
          phaseOrder: 1,
          frequency: 1,
          sameDosePerSchedule: true,
          doseValue: '1',
          doseUnit: DoseUnit.COMP,
          recurrenceType: TreatmentRecurrence.DAILY,
          treatmentDays: 7,
          expectedTimes: ['07:00'],
          expectedStartDate: '2026-02-20',
          expectedEndDate: '2026-02-27',
        },
        {
          phaseOrder: 2,
          frequency: 2,
          sameDosePerSchedule: true,
          doseValue: '1',
          doseUnit: DoseUnit.COMP,
          recurrenceType: TreatmentRecurrence.DAILY,
          treatmentDays: 7,
          expectedTimes: ['07:00', '19:00'],
          expectedStartDate: '2026-02-28',
          expectedEndDate: '2026-03-06',
        },
        {
          phaseOrder: 3,
          frequency: 2,
          sameDosePerSchedule: false,
          perDoseOverrides: [
            { doseLabel: 'D1', doseValue: '2', doseUnit: DoseUnit.COMP },
            { doseLabel: 'D2', doseValue: '1', doseUnit: DoseUnit.COMP },
          ],
          recurrenceType: TreatmentRecurrence.DAILY,
          treatmentDays: 7,
          expectedTimes: ['07:00', '19:00'],
          expectedStartDate: '2026-03-07',
          expectedEndDate: '2026-03-14',
        },
        {
          phaseOrder: 4,
          frequency: 2,
          sameDosePerSchedule: true,
          doseValue: '2',
          doseUnit: DoseUnit.COMP,
          recurrenceType: TreatmentRecurrence.DAILY,
          continuousUse: true,
          expectedTimes: ['07:00', '19:00'],
          expectedStartDate: '2026-03-15',
          expectedEndDate: undefined,
        },
      ],
    } as unknown as Parameters<typeof service.buildAndPersistSchedule>[0];

    const result = await service.buildAndPersistSchedule(
      prescriptionWithTargetPhaseMetadata,
    );

    expect(result).toMatchObject({
      phases: [
        {
          phaseOrder: 1,
          startDate: '2026-02-20',
          endDate: '2026-02-27',
          entries: [{ timeFormatted: '07:00', administrationLabel: '1 COMP' }],
        },
        {
          phaseOrder: 2,
          startDate: '2026-02-28',
          endDate: '2026-03-06',
          entries: [
            { timeFormatted: '07:00', administrationLabel: '1 COMP' },
            { timeFormatted: '19:00', administrationLabel: '1 COMP' },
          ],
        },
        {
          phaseOrder: 3,
          startDate: '2026-03-07',
          endDate: '2026-03-14',
          entries: [
            { timeFormatted: '07:00', administrationLabel: '2 COMP' },
            { timeFormatted: '19:00', administrationLabel: '1 COMP' },
          ],
        },
        {
          phaseOrder: 4,
          startDate: '2026-03-15',
          endDate: undefined,
          entries: [
            { timeFormatted: '07:00', administrationLabel: '2 COMP' },
            { timeFormatted: '19:00', administrationLabel: '2 COMP' },
          ],
        },
      ],
    });
  });

  it('should keep the last phase open-ended when it becomes continuous use', async () => {
    const { service } = createSchedulingService();

    const result = await buildScheduleResult(service, [
      buildItem({
        medication: {
          commercialName: 'CONTRAVE',
        },
        frequency: 2,
        doseAmount: '2 COMP',
        doseValue: '2',
        doseUnit: DoseUnit.COMP,
        sameDosePerSchedule: true,
        continuousUse: true,
        treatmentDays: undefined,
        group: {
          code: GroupCode.GROUP_III,
          name: 'Grupo III',
        },
      }),
    ], {
      startedAt: '2026-03-15',
    });

    expect(result).toMatchObject({
      phases: [
        {
          phaseOrder: 4,
          startDate: '2026-03-15',
          endDate: undefined,
        },
      ],
    });
  });

  it('should start each next phase on the day immediately after the previous phase ends', async () => {
    const { service } = createSchedulingService();

    const result = await buildScheduleResult(service, [
      buildItem({
        medication: {
          commercialName: 'CONTRAVE',
        },
        frequency: 1,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        treatmentDays: 7,
      }),
    ], {
      startedAt: '2026-02-20',
    });

    expect(result).toMatchObject({
      phases: [
        {
          phaseOrder: 1,
          endDate: '2026-02-27',
        },
        {
          phaseOrder: 2,
          startDate: '2026-02-28',
        },
      ],
    });
  });

  it('should require D1..Dn overrides inside a phase when sameDosePerSchedule is false', async () => {
    const { service } = createSchedulingService();

    const result = await buildScheduleResult(service, [
      buildItem({
        medication: {
          commercialName: 'CONTRAVE',
        },
        frequency: 2,
        sameDosePerSchedule: false,
        perDoseOverrides: [
          { doseLabel: 'D1', doseValue: '2', doseUnit: DoseUnit.COMP },
          { doseLabel: 'D2', doseValue: '1', doseUnit: DoseUnit.COMP },
        ],
        treatmentDays: 7,
      }),
    ], {
      startedAt: '2026-03-07',
    });

    expect(result).toMatchObject({
      phases: [
        {
          phaseOrder: 3,
          entries: [
            { doseLabel: 'D1', administrationLabel: '2 COMP' },
            { doseLabel: 'D2', administrationLabel: '1 COMP' },
          ],
        },
      ],
    });
  });
});
