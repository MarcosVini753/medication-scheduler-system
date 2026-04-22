import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import { PatientPrescriptionService } from '../src/modules/patient-prescriptions/patient-prescription.service';

describe('PatientPrescriptionService', () => {
  function createService() {
    const repository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const prescriptionRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ ...entity, id: 'rx-1' })),
      findOne: jest.fn(),
    };

    const medicationRepository = {
      create: jest.fn((entity) => entity),
    };

    const phaseRepository = {
      create: jest.fn((entity) => entity),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        const entityName = typeof entity === 'function' ? entity.name : String(entity);
        if (entityName === 'PatientPrescription') return prescriptionRepository;
        if (entityName === 'PatientPrescriptionMedication') return medicationRepository;
        if (entityName === 'PatientPrescriptionPhase') return phaseRepository;
        return repository;
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const patientService = {
      findById: jest.fn(async (id: string) => ({
        id,
        fullName: 'Paciente Teste',
      })),
    };

    const schedulingService = {
      buildAndPersistSchedule: jest.fn(async (prescription) => ({
        patientId: prescription.patient.id,
        prescriptionId: prescription.id,
        medications: prescription.medications.map((medication) => ({
          prescriptionMedicationId: medication.id ?? 'pm-1',
          sourceClinicalMedicationId: medication.sourceClinicalMedicationId,
          sourceProtocolId: medication.sourceProtocolId,
          medicationName:
            medication.medicationSnapshot.commercialName ??
            medication.medicationSnapshot.activePrinciple,
          activePrinciple: medication.medicationSnapshot.activePrinciple,
          presentation: medication.medicationSnapshot.presentation,
          administrationRoute: medication.medicationSnapshot.administrationRoute,
          usageInstructions: medication.medicationSnapshot.usageInstructions,
          groupCode: medication.protocolSnapshot.groupCode,
          protocolCode: medication.protocolSnapshot.code,
          phases: [],
        })),
      })),
    };

    const service = new PatientPrescriptionService(
      repository as never,
      dataSource as never,
      patientService as never,
      { findMedicationById: jest.fn() } as never,
      schedulingService as never,
    );

    return {
      service,
      repository,
      prescriptionRepository,
      schedulingService,
      patientService,
      clinicalCatalogService:
        (service as unknown as { clinicalCatalogService: { findMedicationById: jest.Mock } })
          .clinicalCatalogService,
    };
  }

  it('creates a patient prescription from clinicalMedicationId and protocolId with full snapshots', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    const clinicalMedication = {
      id: 'clinical-1',
      commercialName: 'LOSARTANA',
      activePrinciple: 'Losartana potassica',
      presentation: 'Comprimido revestido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      protocols: [
        {
          id: 'protocol-1',
          code: 'GROUP_I_STANDARD',
          name: 'Grupo I padrao',
          description: 'Protocolo base',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_I },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              targetProtocolCode: undefined,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
              windowMinutes: undefined,
              priority: 0,
            },
          ],
        },
      ],
    };

    clinicalCatalogService.findMedicationById.mockResolvedValue(clinicalMedication);
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'prescription-medication-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'LOSARTANA',
            activePrinciple: 'Losartana potassica',
            presentation: 'Comprimido revestido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescricao.',
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_I_STANDARD',
            name: 'Grupo I padrao',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_I,
            priority: 0,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                ],
              },
            ],
          },
          interactionRulesSnapshot: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
              priority: 0,
            },
          ],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            },
          ],
        },
      ],
    }));

    const result = await service.create({
      patientId: 'patient-1',
      startedAt: '2026-04-21',
      medications: [
        {
          clinicalMedicationId: 'clinical-1',
          protocolId: 'protocol-1',
          phases: [
            {
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            } as never,
          ],
        },
      ],
    });

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
    const scheduledPrescription = schedulingService.buildAndPersistSchedule.mock.calls[0][0];
    expect(scheduledPrescription.medications[0]).toMatchObject({
      sourceClinicalMedicationId: 'clinical-1',
      sourceProtocolId: 'protocol-1',
      medicationSnapshot: {
        commercialName: 'LOSARTANA',
        activePrinciple: 'Losartana potassica',
      },
      protocolSnapshot: {
        code: 'GROUP_I_STANDARD',
        groupCode: GroupCode.GROUP_I,
      },
      interactionRulesSnapshot: [
        {
          interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
          targetGroupCode: GroupCode.GROUP_III_SAL,
        },
      ],
    });
    expect(result).toMatchObject({
      patientId: 'patient-1',
      prescriptionId: 'rx-1',
    });
  });

  it('keeps prescription snapshots stable even if the clinical catalog object is mutated later', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    const clinicalMedication = {
      id: 'clinical-1',
      commercialName: 'SUCRAFILM',
      activePrinciple: 'Sucralfato',
      presentation: 'Suspensao oral',
      administrationRoute: 'VO',
      usageInstructions: 'Protocolo original.',
      protocols: [
        {
          id: 'protocol-1',
          code: 'GROUP_II_SUCRA',
          name: 'Sucralfato',
          description: 'Protocolo base',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_II_SUCRA },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.ACORDAR,
                  offsetMinutes: 120,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [],
        },
      ],
    };

    clinicalCatalogService.findMedicationById.mockResolvedValue(clinicalMedication);
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'med-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'SUCRAFILM',
            activePrinciple: 'Sucralfato',
            presentation: 'Suspensao oral',
            administrationRoute: 'VO',
            usageInstructions: 'Protocolo original.',
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_II_SUCRA',
            name: 'Sucralfato',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_II_SUCRA,
            priority: 0,
            isDefault: true,
            frequencies: [],
          },
          interactionRulesSnapshot: [],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '10 ML',
              doseValue: '10',
              doseUnit: DoseUnit.ML,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            },
          ],
        },
      ],
    }));

    await service.create({
      patientId: 'patient-1',
      startedAt: '2026-04-21',
      medications: [
        {
          clinicalMedicationId: 'clinical-1',
          protocolId: 'protocol-1',
          phases: [
            {
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '10 ML',
              doseValue: '10',
              doseUnit: DoseUnit.ML,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            } as never,
          ],
        },
      ],
    });

    const capturedSnapshot =
      schedulingService.buildAndPersistSchedule.mock.calls[0][0].medications[0]
        .medicationSnapshot;

    clinicalMedication.activePrinciple = 'Mudou no catalogo';
    clinicalMedication.usageInstructions = 'Mudou depois da prescricao';

    expect(capturedSnapshot).toMatchObject({
      activePrinciple: 'Sucralfato',
      usageInstructions: 'Protocolo original.',
    });
  });

  it('rejects a phase whose frequency is not supported by the chosen protocol', async () => {
    const { service, clinicalCatalogService } = createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      id: 'clinical-1',
      commercialName: 'LOSARTANA',
      activePrinciple: 'Losartana',
      presentation: 'Comprimido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      protocols: [
        {
          id: 'protocol-1',
          code: 'GROUP_I_STANDARD',
          name: 'Grupo I',
          description: 'Protocolo base',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_I },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [],
        },
      ],
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 2,
                sameDosePerSchedule: true,
                doseAmount: '1 COMP',
                doseValue: '1',
                doseUnit: DoseUnit.COMP,
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
