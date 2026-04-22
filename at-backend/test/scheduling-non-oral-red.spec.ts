import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import {
  buildItem,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  expectEntry,
  findEntryByTime,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService non-oral PDF protocols (red specs)', () => {
  it('should schedule Metronidazol gel vaginal at 20:40 instead of defaulting GROUP_DELTA to wake-up', async () => {
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

    const metronidazol = buildItem({
      frequency: 1,
      doseAmount: '1 APLICADOR',
      doseValue: '1',
      doseUnit: DoseUnit.APLICADOR,
      treatmentDays: 5,
      medication: {
        commercialName: 'METRONIDAZOL',
        activePrinciple: 'Metronidazol 100mg/g',
        presentation: 'Gel vaginal 50 g',
        administrationRoute: 'VIA VAGINAL',
        usageInstructions:
          'Introduzir o aplicador profundamente na cavidade vaginal antes de dormir.',
      },
      group: {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
      },
    });

    const result = await buildScheduleResult(service, [metronidazol], {
      startedAt: '2026-02-20',
    });

    expectEntry(findEntryByTime(result, 'METRONIDAZOL', '20:40'), {
      administrationLabel: '1 APLICADOR',
      recurrenceLabel: 'Diario',
      startDate: '2026-02-20',
      endDate: '2026-02-24',
    });
  });

  it('should schedule Cetoconazol creme at 13:00 instead of defaulting GROUP_DELTA to wake-up', async () => {
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

    const cetoconazol = buildItem({
      frequency: 1,
      doseAmount: 'AREA AFETADA',
      doseUnit: DoseUnit.AREA_AFETADA,
      treatmentDays: 30,
      medication: {
        commercialName: 'CETOCONAZOL',
        activePrinciple: 'Cetoconazol 20mg/g',
        presentation: 'Creme 30 g',
        administrationRoute: 'USO TOPICO',
        usageInstructions:
          'Cetoconazol creme deve ser aplicado nas areas infectadas uma vez ao dia.',
      },
      group: {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
      },
    });

    const result = await buildScheduleResult(service, [cetoconazol], {
      startedAt: '2026-02-20',
    });

    expectEntry(findEntryByTime(result, 'CETOCONAZOL', '13:00'), {
      administrationLabel: 'AREA AFETADA',
      recurrenceLabel: 'Diario',
      startDate: '2026-02-20',
      endDate: '2026-03-21',
    });
  });

  it('should allow two GROUP_DELTA medications with frequency 1 to resolve to different times when their clinical protocols differ', async () => {
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

    const metronidazol = buildItem({
      frequency: 1,
      doseAmount: '1 APLICADOR',
      doseValue: '1',
      doseUnit: DoseUnit.APLICADOR,
      treatmentDays: 5,
      medication: {
        commercialName: 'METRONIDAZOL',
      },
      group: {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
      },
    });

    const cetoconazol = buildItem({
      frequency: 1,
      doseAmount: 'AREA AFETADA',
      doseUnit: DoseUnit.AREA_AFETADA,
      treatmentDays: 30,
      medication: {
        commercialName: 'CETOCONAZOL',
      },
      group: {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
      },
    });

    const result = await buildScheduleResult(service, [metronidazol, cetoconazol]);

    expectEntry(findEntryByTime(result, 'METRONIDAZOL', '20:40'), {
      administrationLabel: '1 APLICADOR',
    });
    expectEntry(findEntryByTime(result, 'CETOCONAZOL', '13:00'), {
      administrationLabel: 'AREA AFETADA',
    });
  });

  it('should not behave as if every GROUP_DELTA frequency-1 medication belongs at wake-up', async () => {
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

    const metronidazol = buildItem({
      frequency: 1,
      doseAmount: '1 APLICADOR',
      doseValue: '1',
      doseUnit: DoseUnit.APLICADOR,
      treatmentDays: 5,
      medication: {
        commercialName: 'METRONIDAZOL',
      },
      group: {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
      },
    });

    const result = await buildScheduleResult(service, [metronidazol]);

    expect(findEntryByTime(result, 'METRONIDAZOL', '06:00')).toBeUndefined();
    expectEntry(findEntryByTime(result, 'METRONIDAZOL', '20:40'), {
      administrationLabel: '1 APLICADOR',
    });
  });
});
