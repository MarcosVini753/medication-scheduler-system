import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  buildItem,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  expectEntry,
  expectInactiveEntry,
  findEntryByTime,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService PDF core rules (red specs)', () => {
  describe('sais e antiacidos', () => {
    it('keeps GASTROGEL active at 09:00 and 21:00 when no sensitive medication shares those slots', async () => {
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

      const gastrogel = buildItem({
        frequency: 2,
        doseAmount: '10 ML',
        doseValue: '10',
        doseUnit: DoseUnit.ML,
        treatmentDays: 5,
        medication: {
          commercialName: 'GASTROGEL',
          activePrinciple:
            'Hidroxido de aluminio + Hidroxido de magnesio + simeticona',
          presentation: 'Suspensao oral 150 ml',
          administrationRoute: 'VO',
          usageInstructions: 'Agite o frasco antes de usar.',
          interferesWithSalts: false,
        },
        group: {
          code: GroupCode.GROUP_III_SAL,
          name: 'Grupo III - Sal',
        },
      });

      const metformina = buildItem({
        frequency: 2,
        medication: {
          commercialName: 'GLIFAGE',
        },
        group: {
          code: GroupCode.GROUP_III_MET,
          name: 'Grupo III - Met',
        },
      });

      const result = await buildScheduleResult(service, [gastrogel, metformina]);

      expectEntry(findEntryByTime(result, 'GASTROGEL', '09:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
      expectEntry(findEntryByTime(result, 'GASTROGEL', '21:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
    });

    it('inactivates the bedtime salt dose when a sensitive medication shares 21:00', async () => {
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

      const gastrogel = buildItem({
        frequency: 2,
        doseAmount: '10 ML',
        doseValue: '10',
        doseUnit: DoseUnit.ML,
        treatmentDays: 5,
        medication: {
          commercialName: 'GASTROGEL',
          interferesWithSalts: false,
        },
        group: {
          code: GroupCode.GROUP_III_SAL,
          name: 'Grupo III - Sal',
        },
      });

      const captopril = buildItem({
        frequency: 3,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        treatmentDays: 30,
        medication: {
          commercialName: 'CAPTOPRIL',
          interferesWithSalts: true,
        },
        group: {
          code: GroupCode.GROUP_I,
          name: 'Grupo I',
        },
      });

      const result = await buildScheduleResult(service, [gastrogel, captopril]);

      expectInactiveEntry(findEntryByTime(result, 'GASTROGEL', '21:00'), {
        administrationLabel: '10 ML',
        note: expect.stringContaining('CAPTOPRIL') as never,
      });
      expectEntry(findEntryByTime(result, 'CAPTOPRIL', '21:00'), {
        administrationLabel: '1 COMP',
      });
    });
  });

  describe('sucralfato', () => {
    const sucralfatoRoutine = buildRoutine({
      acordar: '06:00',
      cafe: '07:00',
      almoco: '13:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildSucralfatoItem(overrides: Parameters<typeof buildItem>[0] = {}) {
      return buildItem({
        frequency: 2,
        doseAmount: '10 ML',
        doseValue: '10',
        doseUnit: DoseUnit.ML,
        treatmentDays: 30,
        medication: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 flaconete 1 hora antes ou 2 horas apos as refeicoes.',
          interferesWithSalts: true,
          ...(overrides.medication ?? {}),
        },
        group: {
          code: GroupCode.GROUP_II_SUCRA,
          name: 'Grupo II - Sucra',
          ...(overrides.group ?? {}),
        },
        ...overrides,
      });
    }

    it('keeps SUCRAFILM at 08:00 and 21:00 when there is no conflict', async () => {
      const { service } = createSchedulingService({ routine: sucralfatoRoutine });

      const result = await buildScheduleResult(service, [buildSucralfatoItem()]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
    });

    it('moves SUCRAFILM D1 to 15:00 when another medication occupies 08:00', async () => {
      const { service } = createSchedulingService({ routine: sucralfatoRoutine });

      const macrogol = buildItem({
        frequency: 1,
        doseAmount: '17 ML',
        doseValue: '17',
        doseUnit: DoseUnit.ML,
        treatmentDays: 30,
        medication: {
          commercialName: 'MACROGOL',
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['08:00'],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoItem(),
        macrogol,
      ]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '15:00'), {
        administrationLabel: '10 ML',
        note: expect.stringContaining('almoço + 2h') as never,
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
    });

    it('should treat GROUP_I_SED at 20:40 as clinically equivalent to bedtime and inactivate SUCRAFILM at 21:00', async () => {
      const { service } = createSchedulingService({ routine: sucralfatoRoutine });

      const clonazepam = buildItem({
        frequency: 1,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        treatmentDays: 30,
        medication: {
          commercialName: 'CLONAZEPAM',
        },
        group: {
          code: GroupCode.GROUP_I_SED,
          name: 'Grupo I - Sed',
        },
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoItem(),
        clonazepam,
      ]);

      expectInactiveEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expectEntry(findEntryByTime(result, 'CLONAZEPAM', '20:40'), {
        administrationLabel: '1 COMP',
      });
    });

    it('inactivates SUCRAFILM D1 when both 08:00 and the fallback 15:00 are occupied', async () => {
      const { service } = createSchedulingService({ routine: sucralfatoRoutine });

      const occupiedMorning = buildItem({
        frequency: 1,
        doseAmount: '17 ML',
        doseValue: '17',
        doseUnit: DoseUnit.ML,
        treatmentDays: 30,
        medication: {
          commercialName: 'MACROGOL',
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['08:00'],
      });

      const occupiedFallback = buildItem({
        frequency: 1,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        treatmentDays: 30,
        medication: {
          commercialName: 'LOSARTANA EXTRA',
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['15:00'],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoItem(),
        occupiedMorning,
        occupiedFallback,
      ]);

      expectInactiveEntry(
        result.entries.find(
          (entry) =>
            entry.medicationName === 'SUCRAFILM' &&
            entry.note?.includes('inativado') &&
            entry.status === ScheduleStatus.INACTIVE,
        ),
        {
          administrationLabel: '10 ML',
        },
      );
    });

    it('inactivates only the bedtime SUCRAFILM dose when the conflict exists only at 21:00', async () => {
      const { service } = createSchedulingService({ routine: sucralfatoRoutine });

      const bedtimeConflict = buildItem({
        frequency: 1,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        treatmentDays: 30,
        medication: {
          commercialName: 'MEDICAMENTO 21H',
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['21:00'],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoItem(),
        bedtimeConflict,
      ]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expectInactiveEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
    });

    it('keeps frequency-1 SUCRAFILM only at ACORDAR + 2h', async () => {
      const { service } = createSchedulingService({ routine: sucralfatoRoutine });

      const result = await buildScheduleResult(service, [
        buildSucralfatoItem({ frequency: 1 }),
      ]);

      expect(result.entries.filter((entry) => entry.medicationName === 'SUCRAFILM')).toHaveLength(1);
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
    });
  });

  describe('calcio', () => {
    const calcioRoutine = buildRoutine({
      acordar: '05:00',
      cafe: '07:00',
      almoco: '12:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildCalcioItem(overrides: Parameters<typeof buildItem>[0] = {}) {
      return buildItem({
        frequency: 2,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        continuousUse: true,
        treatmentDays: undefined,
        medication: {
          commercialName: 'CALCIO',
          activePrinciple: 'Citrato malato 250 mg + Vitamina D3 5000 UI',
          interferesWithSalts: true,
          ...(overrides.medication ?? {}),
        },
        group: {
          code: GroupCode.GROUP_III_CALC,
          name: 'Grupo III - Calc',
          ...(overrides.group ?? {}),
        },
        ...overrides,
      });
    }

    it('keeps GROUP_III_CALC at 10:00 and 21:00 when there is no conflict', async () => {
      const { service } = createSchedulingService({ routine: calcioRoutine });

      const result = await buildScheduleResult(service, [buildCalcioItem()], {
        startedAt: '2026-02-20',
      });

      expectEntry(findEntryByTime(result, 'CALCIO', '10:00'), {
        administrationLabel: '1 COMP',
        recurrenceLabel: 'Uso continuo',
      });
      expectEntry(findEntryByTime(result, 'CALCIO', '21:00'), {
        administrationLabel: '1 COMP',
        recurrenceLabel: 'Uso continuo',
      });
    });

    it('moves the bedtime calcium dose to 22:00 when a conflicting medication shares 21:00', async () => {
      // Expected behavior comes from the PDF rule, not from the current generic boolean interaction model.
      const { service } = createSchedulingService({ routine: calcioRoutine });

      const conflictingMedication = buildItem({
        frequency: 1,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        continuousUse: true,
        treatmentDays: undefined,
        medication: {
          commercialName: 'MEDICAMENTO DO GRUPO I',
          interferesWithSalts: true,
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['21:00'],
      });

      const result = await buildScheduleResult(service, [
        buildCalcioItem(),
        conflictingMedication,
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '10:00'), {
        administrationLabel: '1 COMP',
      });
      expectEntry(findEntryByTime(result, 'CALCIO', '22:00'), {
        administrationLabel: '1 COMP',
        note: expect.stringContaining('1 hora') as never,
      });
    });

    it('moves the morning calcium dose to 11:00 when the conflict exists at 10:00', async () => {
      // Expected behavior comes from the PDF rule, not from the current generic boolean interaction model.
      const { service } = createSchedulingService({ routine: calcioRoutine });

      const conflictingMedication = buildItem({
        frequency: 1,
        doseAmount: '1 COMP',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
        continuousUse: true,
        treatmentDays: undefined,
        medication: {
          commercialName: 'MEDICAMENTO 10H',
          interferesWithSalts: true,
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['10:00'],
      });

      const result = await buildScheduleResult(service, [
        buildCalcioItem(),
        conflictingMedication,
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '11:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('moves calcium only once when multiple medications share the same conflicting slot', async () => {
      // Expected behavior comes from the PDF rule, not from the current generic boolean interaction model.
      const { service } = createSchedulingService({ routine: calcioRoutine });

      const conflictA = buildItem({
        medication: {
          commercialName: 'CONFLITO A',
          interferesWithSalts: true,
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['21:00'],
        continuousUse: true,
        treatmentDays: undefined,
      });
      const conflictB = buildItem({
        medication: {
          commercialName: 'CONFLITO B',
          interferesWithSalts: true,
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['21:00'],
        continuousUse: true,
        treatmentDays: undefined,
      });

      const result = await buildScheduleResult(service, [
        buildCalcioItem(),
        conflictA,
        conflictB,
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '22:00'), {
        administrationLabel: '1 COMP',
      });
      expect(findEntryByTime(result, 'CALCIO', '23:00')).toBeUndefined();
    });

    it('should require manual adjustment instead of endlessly pushing calcium when the shifted slot still conflicts', async () => {
      // Expected behavior comes from the PDF rule, not from the current generic boolean interaction model.
      const { service } = createSchedulingService({ routine: calcioRoutine });

      const conflictOriginal = buildItem({
        medication: {
          commercialName: 'CONFLITO 21H',
          interferesWithSalts: true,
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['21:00'],
        continuousUse: true,
        treatmentDays: undefined,
      });
      const conflictShifted = buildItem({
        medication: {
          commercialName: 'CONFLITO 22H',
          interferesWithSalts: true,
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['22:00'],
        continuousUse: true,
        treatmentDays: undefined,
      });

      const result = await buildScheduleResult(service, [
        buildCalcioItem(),
        conflictOriginal,
        conflictShifted,
      ]);

      expect(
        result.entries.find(
          (entry) =>
            entry.medicationName === 'CALCIO' &&
            entry.status === ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
        ),
      ).toMatchObject({
        administrationLabel: '1 COMP',
      });
    });
  });

  describe('green references and domain edges', () => {
    it('keeps a green reference for GROUP_I', async () => {
      const { service } = createSchedulingService();

      const result = await buildScheduleResult(service, [
        buildItem({
          medication: { commercialName: 'LOSARTANA' },
          group: { code: GroupCode.GROUP_I, name: 'Grupo I' },
        }),
      ]);

      expectEntry(findEntryByTime(result, 'LOSARTANA', '07:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('keeps a green reference for GROUP_II_BIFOS', async () => {
      const { service } = createSchedulingService();

      const result = await buildScheduleResult(service, [
        buildItem({
          medication: { commercialName: 'ALENDRONATO' },
          group: { code: GroupCode.GROUP_II_BIFOS, name: 'Grupo II - Bifos' },
        }),
      ]);

      expectEntry(findEntryByTime(result, 'ALENDRONATO', '05:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('keeps a green reference for GROUP_III_MET', async () => {
      const { service } = createSchedulingService();

      const result = await buildScheduleResult(service, [
        buildItem({
          frequency: 3,
          medication: { commercialName: 'GLIFAGE' },
          group: { code: GroupCode.GROUP_III_MET, name: 'Grupo III - Met' },
        }),
      ]);

      expectEntry(findEntryByTime(result, 'GLIFAGE', '07:00'), {
        administrationLabel: '1 COMP',
      });
      expectEntry(findEntryByTime(result, 'GLIFAGE', '12:00'), {
        administrationLabel: '1 COMP',
      });
      expectEntry(findEntryByTime(result, 'GLIFAGE', '19:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('keeps throwing a clear exception when the frequency is not registered by the protocol', async () => {
      const { service } = createSchedulingService();

      await expect(
        buildScheduleResult(service, [
          buildItem({
            medication: { commercialName: 'MEDICAMENTO INVALIDO' },
            group: { code: GroupCode.GROUP_I, name: 'Grupo I' },
            frequency: 99,
          }),
        ]),
      ).rejects.toThrow(
        'Fórmula não cadastrada para grupo GROUP_I e frequência 99.',
      );
    });

    it('prefers the PDF clinical conflict over a simple exact-time coexistence rule when both apply', async () => {
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

      const sucralfato = buildItem({
        frequency: 2,
        doseAmount: '10 ML',
        doseValue: '10',
        doseUnit: DoseUnit.ML,
        treatmentDays: 30,
        medication: {
          commercialName: 'SUCRAFILM',
          interferesWithSalts: true,
        },
        group: {
          code: GroupCode.GROUP_II_SUCRA,
          name: 'Grupo II - Sucra',
        },
      });

      const sedative = buildItem({
        medication: {
          commercialName: 'CLONAZEPAM',
        },
        group: {
          code: GroupCode.GROUP_I_SED,
          name: 'Grupo I - Sed',
        },
      });

      const exact21hOccupant = buildItem({
        medication: {
          commercialName: 'MEDICAMENTO 21H',
        },
        manualAdjustmentEnabled: true,
        manualTimes: ['21:00'],
      });

      const result = await buildScheduleResult(service, [
        sucralfato,
        sedative,
        exact21hOccupant,
      ]);

      expectInactiveEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expectEntry(findEntryByTime(result, 'CLONAZEPAM', '20:40'), {
        administrationLabel: '1 COMP',
      });
    });
  });
});
