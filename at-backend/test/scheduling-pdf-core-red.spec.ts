import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import {
  buildInteractionRule,
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  expectEntry,
  expectInactiveEntry,
  findEntriesByMedication,
  findEntriesByMedicationAndTime,
  findEntryByTime,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService PDF core rules', () => {
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

      const gastrogel = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GASTROGEL',
          activePrinciple:
            'Hidroxido de aluminio + Hidroxido de magnesio + simeticona',
          presentation: 'Suspensao oral 150 ml',
          administrationRoute: 'VO',
          usageInstructions: 'Agite o frasco antes de usar.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_SAL),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 5,
          }),
        ],
      });

      const metformina = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GLIFAGE',
          activePrinciple: 'Metformina',
          presentation: 'Comprimido revestido',
          administrationRoute: 'VO',
          usageInstructions: 'Tomar junto das refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_MET),
        phases: [buildPhase({ frequency: 2, doseAmount: '1 COMP' })],
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

      const gastrogel = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GASTROGEL',
          activePrinciple: 'Hidroxido de aluminio + magnesio',
          presentation: 'Suspensao oral',
          administrationRoute: 'VO',
          usageInstructions: 'Agite o frasco antes de usar.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_SAL),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 5,
          }),
        ],
      });

      const captopril = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CAPTOPRIL',
          activePrinciple: 'Captopril',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Conforme prescricao.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
            targetGroupCode: GroupCode.GROUP_III_SAL,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 3,
            doseAmount: '1 COMP',
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
            treatmentDays: 30,
          }),
        ],
      });

      const result = await buildScheduleResult(service, [gastrogel, captopril]);

      const inactiveSaltEntry = findEntryByTime(result, 'GASTROGEL', '21:00');
      expectInactiveEntry(inactiveSaltEntry, {
        administrationLabel: '10 ML',
      });
      expect(inactiveSaltEntry?.note).toContain('CAPTOPRIL');
      expectEntry(findEntryByTime(result, 'CAPTOPRIL', '21:00'), {
        administrationLabel: '1 COMP',
      });
    });
  });

  describe('sucralfato', () => {
    const routine = buildRoutine({
      acordar: '06:00',
      cafe: '07:00',
      almoco: '13:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildSucralfatoMedication() {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 30,
          }),
        ],
      });
    }

    it('keeps SUCRAFILM at 08:00 and 21:00 when there is no conflict', async () => {
      const { service } = createSchedulingService({ routine });

      const result = await buildScheduleResult(service, [buildSucralfatoMedication()]);

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
      const { service } = createSchedulingService({ routine });

      const occupiedMorning = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'MACROGOL',
          activePrinciple: 'Macrogol',
          presentation: 'Solucao oral',
          administrationRoute: 'VO',
          usageInstructions: 'Usar conforme orientacao.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '17 G',
            manualAdjustmentEnabled: true,
            manualTimes: ['08:00'],
            treatmentDays: 30,
          }),
        ],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        occupiedMorning,
      ]);

      const movedEntry = findEntryByTime(result, 'SUCRAFILM', '15:00');
      expectEntry(movedEntry, {
        administrationLabel: '10 ML',
      });
      expect(movedEntry?.note).toContain('almoço + 2h');
      expect(findEntryByTime(result, 'SUCRAFILM', '08:00')).toBeUndefined();
      expect(findEntriesByMedicationAndTime(result, 'SUCRAFILM', '15:00')).toHaveLength(1);
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
    });

    it('treats GROUP_I_SED at 20:40 as clinically equivalent to bedtime and inactivates SUCRAFILM at 21:00', async () => {
      const { service } = createSchedulingService({ routine });

      const clonazepam = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CLONAZEPAM',
          activePrinciple: 'Clonazepam',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar 20 minutos antes de dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SED),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
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
      const { service } = createSchedulingService({ routine });

      const morningBlock = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'BLOQUEIO MANHA',
          activePrinciple: 'Bloqueio manha',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Horario fixo de teste.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        phases: [
          buildPhase({
            frequency: 1,
            manualAdjustmentEnabled: true,
            manualTimes: ['08:00'],
            treatmentDays: 10,
          }),
        ],
      });

      const afternoonBlock = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'BLOQUEIO TARDE',
          activePrinciple: 'Bloqueio tarde',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Horario fixo de teste.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        phases: [
          buildPhase({
            frequency: 1,
            manualAdjustmentEnabled: true,
            manualTimes: ['15:00'],
            treatmentDays: 10,
          }),
        ],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        morningBlock,
        afternoonBlock,
      ]);

      const inactiveMorning = findEntryByTime(result, 'SUCRAFILM', '08:00');
      expectInactiveEntry(inactiveMorning, {
        administrationLabel: '10 ML',
      });
      expect(inactiveMorning?.note).toContain('horário principal e no alternativo');
      expect(findEntryByTime(result, 'SUCRAFILM', '15:00')).toBeUndefined();
      expect(findEntriesByMedication(result, 'SUCRAFILM')).toHaveLength(2);
    });

    it('inactivates only the bedtime SUCRAFILM dose when the conflict exists only at 21:00', async () => {
      const { service } = createSchedulingService({ routine });

      const bedtimeConflict = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'ZOLPIDEM',
          activePrinciple: 'Zolpidem',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar ao dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          code: 'GROUP_I_BEDTIME_EXACT',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: 'DORMIR' as never,
                  offsetMinutes: 0,
                  semanticTag: 'BEDTIME_SLOT' as never,
                },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        bedtimeConflict,
      ]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expectInactiveEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntryByTime(result, 'SUCRAFILM', '15:00')).toBeUndefined();
    });

    it('uses only ACORDAR + 2h when SUCRAFILM frequency is 1', async () => {
      const { service } = createSchedulingService({ routine });

      const result = await buildScheduleResult(service, [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'SUCRAFILM',
            activePrinciple: 'Sucralfato',
            presentation: 'Suspensao oral',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme protocolo.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
          phases: [
            buildPhase({
              frequency: 1,
              doseAmount: '10 ML',
              doseValue: '10',
              doseUnit: DoseUnit.ML,
              treatmentDays: 10,
            }),
          ],
        }),
      ]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntryByTime(result, 'SUCRAFILM', '21:00')).toBeUndefined();
    });
  });

  describe('calcio', () => {
    const routine = buildRoutine({
      acordar: '05:00',
      cafe: '07:00',
      almoco: '12:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildCalciumMedication() {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CALCIO',
          activePrinciple: 'Carbonato de calcio',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Usar afastado de interacoes clinicas.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_CALC),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '1 COMP',
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
            treatmentDays: 30,
          }),
        ],
      });
    }

    function buildCalciumSensitiveMedication(
      name: string,
      time: string,
      note = 'Horario fixo de conflito para o calcio.',
      interactionRuleOverrides: Partial<ReturnType<typeof buildInteractionRule>> = {},
    ) {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: name,
          activePrinciple: name,
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: note,
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            targetGroupCode: GroupCode.GROUP_III_CALC,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            ...interactionRuleOverrides,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '1 COMP',
            manualAdjustmentEnabled: true,
            manualTimes: [time],
            treatmentDays: 30,
          }),
        ],
      });
    }

    it('keeps GROUP_III_CALC at 10:00 and 21:00 when there is no conflict', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [buildCalciumMedication()]);

      expectEntry(findEntryByTime(result, 'CALCIO', '10:00'), {
        administrationLabel: '1 COMP',
      });
      expectEntry(findEntryByTime(result, 'CALCIO', '21:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('moves the bedtime calcium dose to 22:00 when a conflicting medication occupies 21:00', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('LEVOTIROXINA', '21:00'),
      ]);

      const movedCalcium = findEntryByTime(result, 'CALCIO', '22:00');
      expectEntry(movedCalcium, {
        administrationLabel: '1 COMP',
      });
      expect(movedCalcium?.note).toContain('LEVOTIROXINA');
      expect(findEntryByTime(result, 'CALCIO', '21:00')).toBeUndefined();
      expect(findEntriesByMedicationAndTime(result, 'CALCIO', '22:00')).toHaveLength(1);
    });

    it('moves the morning calcium dose to 11:00 when the conflict exists at 10:00', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('DOXICICLINA', '10:00'),
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '11:00'), {
        administrationLabel: '1 COMP',
      });
      expect(findEntryByTime(result, 'CALCIO', '10:00')).toBeUndefined();
      expect(findEntryByTime(result, 'CALCIO', '21:00')).toBeDefined();
    });

    it('moves calcium only once even when multiple medications share the original conflicting time', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('MEDICAMENTO A', '21:00'),
        buildCalciumSensitiveMedication('MEDICAMENTO B', '21:00'),
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '22:00'), {
        administrationLabel: '1 COMP',
      });
      expect(findEntryByTime(result, 'CALCIO', '23:00')).toBeUndefined();
      expect(findEntriesByMedicationAndTime(result, 'CALCIO', '22:00')).toHaveLength(1);
    });

    it('marks calcium as MANUAL_ADJUSTMENT_REQUIRED when the shifted time still conflicts', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('MEDICAMENTO 21', '21:00'),
        buildCalciumSensitiveMedication('MEDICAMENTO 22', '22:00'),
      ]);

      const calciumEntry = findEntryByTime(result, 'CALCIO', '22:00');
      expect(calciumEntry).toBeDefined();
      expect(calciumEntry?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(calciumEntry?.note).toContain('ajuste manual');
    });

    it('uses rule windowMinutes to shift calcium by 120 minutes when configured', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('FERRO', '21:00', 'Conflito com calcio.', {
          windowMinutes: 120,
        }),
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '23:00'), {
        administrationLabel: '1 COMP',
      });
      expect(findEntryByTime(result, 'CALCIO', '22:00')).toBeUndefined();
      expect(findEntryByTime(result, 'CALCIO', '21:00')).toBeUndefined();
    });

    it('prefers REQUIRE_MANUAL_ADJUSTMENT over SHIFT_SOURCE_BY_WINDOW when both rules match and manual has higher priority', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication(
          'BLOQUEADOR SHIFT',
          '21:00',
          'Regra de deslocamento.',
          {
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            priority: 10,
          },
        ),
        buildCalciumSensitiveMedication(
          'BLOQUEADOR MANUAL',
          '21:00',
          'Regra de ajuste manual prioritario.',
          {
            resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
            priority: 100,
          },
        ),
      ]);

      const calciumAt21 = findEntryByTime(result, 'CALCIO', '21:00');
      expect(calciumAt21).toBeDefined();
      expect(calciumAt21?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(findEntryByTime(result, 'CALCIO', '22:00')).toBeUndefined();
    });

    it('uses rule priority instead of medication ordering when multiple calcium rules match', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication(
          'AAA SHIFT',
          '21:00',
          'Bloqueador alfabeticamente primeiro.',
          {
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            priority: 10,
          },
        ),
        buildCalciumSensitiveMedication(
          'ZZZ MANUAL',
          '21:00',
          'Bloqueador alfabeticamente depois, mas clinicamente prioritario.',
          {
            resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
            priority: 100,
          },
        ),
      ]);

      const calciumAt21 = findEntryByTime(result, 'CALCIO', '21:00');
      expect(calciumAt21).toBeDefined();
      expect(calciumAt21?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(calciumAt21?.conflict).toMatchObject({
        triggerMedicationName: 'ZZZ MANUAL',
        resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
        rulePriority: 100,
      });
    });

    it('is deterministic with multiple blockers and marks manual adjustment at the first persistent conflict slot', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('BLOQUEADOR 21', '21:00'),
        buildCalciumSensitiveMedication('BLOQUEADOR 22', '22:00'),
        buildCalciumSensitiveMedication('BLOQUEADOR 23', '23:00'),
      ]);

      const calciumAt22 = findEntryByTime(result, 'CALCIO', '22:00');
      expect(calciumAt22).toBeDefined();
      expect(calciumAt22?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(findEntryByTime(result, 'CALCIO', '23:00')).toBeUndefined();
    });
  });

  describe('sucralfato com janela configuravel', () => {
    const routine = buildRoutine({
      acordar: '06:00',
      cafe: '07:00',
      almoco: '13:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    it('inactivates SUCRAFILM at 21:00 when bedtime-equivalent conflict is 29 minutes away and rule window is 30', async () => {
      const { service } = createSchedulingService({ routine });

      const sucralfato = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 30,
          }),
        ],
      });

      const sedativo = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SEDATIVO TESTE',
          activePrinciple: 'Sedativo',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar proximo ao horario de dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SED, {
          code: 'GROUP_I_SED_2031',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: 'DORMIR' as never,
                  offsetMinutes: -29,
                  semanticTag: 'BEDTIME_EQUIVALENT' as never,
                },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            windowMinutes: 30,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [sucralfato, sedativo]);

      expectInactiveEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expectEntry(findEntryByTime(result, 'SEDATIVO TESTE', '20:31'), {
        administrationLabel: '1 COMP',
      });
    });

    it('does not inactivate SUCRAFILM when bedtime-equivalent conflict is outside configured window', async () => {
      const { service } = createSchedulingService({ routine });

      const sucralfato = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 30,
          }),
        ],
      });

      const sedativo = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SEDATIVO LIMITE',
          activePrinciple: 'Sedativo Limite',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar proximo ao horario de dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SED, {
          code: 'GROUP_I_SED_2039',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: 'DORMIR' as never,
                  offsetMinutes: -21,
                  semanticTag: 'BEDTIME_EQUIVALENT' as never,
                },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            windowMinutes: 20,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [sucralfato, sedativo]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntryByTime(result, 'SUCRAFILM', '15:00')).toBeUndefined();
    });
  });
});
