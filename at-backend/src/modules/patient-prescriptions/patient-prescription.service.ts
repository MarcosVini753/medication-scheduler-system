import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClinicalCatalogService } from '../clinical-catalog/clinical-catalog.service';
import { PatientService } from '../patients/patient.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import { CreatePatientPrescriptionDto } from './dto/create-patient-prescription.dto';
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
} from './entities/patient-prescription-snapshot.types';
import { PatientPrescriptionMedication } from './entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from './entities/patient-prescription-phase.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';

type PrescriptionMedicationPhaseDto =
  CreatePatientPrescriptionDto['medications'][number]['phases'][number];
type ClinicalMedicationCatalogEntry = Awaited<
  ReturnType<ClinicalCatalogService['findMedicationById']>
>;

@Injectable()
export class PatientPrescriptionService {
  constructor(
    @InjectRepository(PatientPrescription)
    private readonly prescriptionRepository: Repository<PatientPrescription>,
    private readonly dataSource: DataSource,
    private readonly patientService: PatientService,
    private readonly clinicalCatalogService: ClinicalCatalogService,
    private readonly schedulingService: SchedulingService,
  ) {}

  async create(dto: CreatePatientPrescriptionDto) {
    const patient = await this.patientService.findById(dto.patientId);

    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepository = manager.getRepository(PatientPrescription);
      const prescriptionMedicationRepository = manager.getRepository(
        PatientPrescriptionMedication,
      );
      const phaseRepository = manager.getRepository(PatientPrescriptionPhase);

      const medications = await Promise.all(
        dto.medications.map(async (medicationDto) => {
          const clinicalMedication = await this.clinicalCatalogService.findMedicationById(
            medicationDto.clinicalMedicationId,
          );
          const protocol = clinicalMedication.protocols.find(
            (item) => item.id === medicationDto.protocolId,
          );
          if (!protocol) {
            throw new NotFoundException(
              'Protocolo clínico não encontrado para o medicamento informado.',
            );
          }

          this.ensureSequentialPhaseOrders(medicationDto.phases);
          this.ensureMedicationSupportsPhaseDomainRules(clinicalMedication, medicationDto.phases);
          this.ensureProtocolSupportsPhases(
            protocolSnapshotFromEntity(protocol),
            medicationDto.phases,
          );

          const medication = prescriptionMedicationRepository.create({
            sourceClinicalMedicationId: clinicalMedication.id,
            sourceProtocolId: protocol.id,
            medicationSnapshot: medicationSnapshotFromEntity(clinicalMedication),
            protocolSnapshot: protocolSnapshotFromEntity(protocol),
            interactionRulesSnapshot: interactionRulesSnapshotFromEntity(protocol),
            phases: medicationDto.phases.map((phaseDto) =>
              phaseRepository.create({
                ...phaseDto,
                doseAmount: phaseDto.doseAmount ?? phaseDto.doseValue ?? '1 unidade',
              }),
            ),
          });

          return medication;
        }),
      );

      const prescription = await prescriptionRepository.save(
        prescriptionRepository.create({
          patient,
          startedAt: dto.startedAt,
          status: 'ACTIVE',
          medications,
        }),
      );

      const loaded = await prescriptionRepository.findOne({
        where: { id: prescription.id },
        relations: [
          'patient',
          'medications',
          'medications.phases',
        ],
      });

      if (!loaded) {
        throw new NotFoundException('Prescrição do paciente não encontrada.');
      }

      return this.schedulingService.buildAndPersistSchedule(loaded, manager);
    });
  }

  async list(): Promise<PatientPrescription[]> {
    return this.prescriptionRepository.find({
      relations: ['patient', 'medications', 'medications.phases'],
    });
  }

  async findById(id: string): Promise<PatientPrescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    return prescription;
  }

  private ensureProtocolSupportsPhases(
    protocolSnapshot: ClinicalProtocolSnapshot,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    phases.forEach((phase) => {
      const supportedFrequency = protocolSnapshot.frequencies.find(
        (item) => item.frequency === phase.frequency,
      );
      if (!supportedFrequency) {
        throw new UnprocessableEntityException(
          `Fase ${phase.phaseOrder}: frequency=${phase.frequency} não é suportada pelo protocolo ${protocolSnapshot.code}.`,
        );
      }

      this.ensurePhaseMatchesFrequencyRules(protocolSnapshot, supportedFrequency, phase);
    });
  }

  private ensurePhaseMatchesFrequencyRules(
    protocolSnapshot: ClinicalProtocolSnapshot,
    frequencySnapshot: ClinicalProtocolSnapshot['frequencies'][number],
    phase: CreatePatientPrescriptionDto['medications'][number]['phases'][number],
  ): void {
    if (
      frequencySnapshot.allowedRecurrenceTypes?.length &&
      !frequencySnapshot.allowedRecurrenceTypes.includes(phase.recurrenceType)
    ) {
      throw new UnprocessableEntityException(
        `Fase ${phase.phaseOrder}: recurrenceType=${phase.recurrenceType} não é permitido no protocolo ${protocolSnapshot.code} para frequency=${phase.frequency}.`,
      );
    }

    if (
      phase.recurrenceType === TreatmentRecurrence.PRN &&
      frequencySnapshot.allowsPrn === false
    ) {
      throw new UnprocessableEntityException(
        `Fase ${phase.phaseOrder}: recurrenceType=PRN não é permitido no protocolo ${protocolSnapshot.code} para frequency=${phase.frequency}.`,
      );
    }

    if (
      phase.sameDosePerSchedule === false &&
      frequencySnapshot.allowsVariableDoseBySchedule === false
    ) {
      throw new UnprocessableEntityException(
        `Fase ${phase.phaseOrder}: sameDosePerSchedule=false não é permitido no protocolo ${protocolSnapshot.code} para frequency=${phase.frequency}.`,
      );
    }
  }

  private ensureSequentialPhaseOrders(
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    const sortedOrders = [...phases].map((phase) => phase.phaseOrder).sort((a, b) => a - b);
    const expectedOrders = Array.from({ length: sortedOrders.length }, (_, index) => index + 1);
    const isSequential = sortedOrders.every((order, index) => order === expectedOrders[index]);
    if (!isSequential) {
      throw new UnprocessableEntityException(
        'As fases terapêuticas devem usar phaseOrder sequencial, sem lacunas nem repetição.',
      );
    }
  }

  private ensureMedicationSupportsPhaseDomainRules(
    medication: ClinicalMedicationCatalogEntry,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    const isOphthalmic = Boolean(medication.isOphthalmic);
    const isOtic = Boolean(medication.isOtic);
    const requiresGlycemiaScale = Boolean(medication.requiresGlycemiaScale);
    const isContraceptiveMonthly = Boolean(medication.isContraceptiveMonthly);
    const supportsManualAdjustment = Boolean(medication.supportsManualAdjustment);

    if (isOphthalmic && isOtic) {
      this.throwMedicationDomainError(
        medication.id,
        'é ambíguo para lateralidade',
        'isOphthalmic=true e isOtic=true',
      );
    }

    phases.forEach((phase) => {
      this.ensureLateralityCompatibilityForPhase(medication.id, phase, isOphthalmic, isOtic);
      this.ensureGlycemiaScaleCompatibilityForPhase(medication.id, phase, requiresGlycemiaScale);
      this.ensureContraceptiveMonthlyCompatibilityForPhase(
        medication.id,
        phase,
        isContraceptiveMonthly,
      );
      this.ensureManualAdjustmentCompatibilityForPhase(
        medication.id,
        phase,
        supportsManualAdjustment,
      );
    });
  }

  private ensureLateralityCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    isOphthalmic: boolean,
    isOtic: boolean,
  ): void {
    if (isOphthalmic) {
      if (!phase.ocularLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'ocularLaterality',
          'é obrigatório',
          'isOphthalmic=true',
        );
      }
      if (phase.oticLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'oticLaterality',
          'é inválido',
          'isOphthalmic=true',
        );
      }
      return;
    }

    if (isOtic) {
      if (!phase.oticLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'oticLaterality',
          'é obrigatório',
          'isOtic=true',
        );
      }
      if (phase.ocularLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'ocularLaterality',
          'é inválido',
          'isOtic=true',
        );
      }
      return;
    }

    if (phase.ocularLaterality || phase.oticLaterality) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'lateralidade',
        'é inválida',
        'isOphthalmic=false e isOtic=false',
      );
    }
  }

  private ensureGlycemiaScaleCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    requiresGlycemiaScale: boolean,
  ): void {
    const ranges = phase.glycemiaScaleRanges;
    if (requiresGlycemiaScale) {
      if (!ranges?.length) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'glycemiaScaleRanges',
          'é obrigatório',
          'requiresGlycemiaScale=true',
        );
      }
      this.ensureValidGlycemiaScaleRanges(
        medicationId,
        phase.phaseOrder,
        ranges,
      );
      return;
    }

    if (ranges?.length) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'glycemiaScaleRanges',
        'é inválido',
        'requiresGlycemiaScale=false',
      );
    }
  }

  private ensureValidGlycemiaScaleRanges(
    medicationId: string,
    phaseOrder: number,
    ranges: NonNullable<
      CreatePatientPrescriptionDto['medications'][number]['phases'][number]['glycemiaScaleRanges']
    >,
  ): void {
    const sortedRanges = [...ranges].sort((a, b) => a.minimum - b.minimum);

    sortedRanges.forEach((range, index) => {
      if (range.maximum < range.minimum) {
        throw new UnprocessableEntityException(
          `Fase ${phaseOrder}: glycemiaScaleRanges é inválido para medicamento ${medicationId} (maximum < minimum).`,
        );
      }

      if (index === 0) {
        return;
      }

      const previousRange = sortedRanges[index - 1];
      if (range.minimum <= previousRange.maximum) {
        throw new UnprocessableEntityException(
          `Fase ${phaseOrder}: glycemiaScaleRanges é inválido para medicamento ${medicationId} (faixas com sobreposição).`,
        );
      }

      if (range.minimum !== previousRange.maximum + 1) {
        throw new UnprocessableEntityException(
          `Fase ${phaseOrder}: glycemiaScaleRanges é inválido para medicamento ${medicationId} (faixas com lacuna).`,
        );
      }
    });
  }

  private ensureContraceptiveMonthlyCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    isContraceptiveMonthly: boolean,
  ): void {
    const hasMonthlySpecialFields =
      Boolean(phase.monthlySpecialReference) ||
      Boolean(phase.monthlySpecialBaseDate) ||
      phase.monthlySpecialOffsetDays !== undefined;

    if (isContraceptiveMonthly) {
      if (phase.recurrenceType !== TreatmentRecurrence.MONTHLY) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'recurrenceType',
          `=${phase.recurrenceType} é inválido`,
          'isContraceptiveMonthly=true exige MONTHLY',
        );
      }
      if (
        !phase.monthlySpecialReference ||
        !phase.monthlySpecialBaseDate ||
        phase.monthlySpecialOffsetDays === undefined
      ) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'monthlySpecialReference/monthlySpecialBaseDate/monthlySpecialOffsetDays',
          'são obrigatórios',
          'isContraceptiveMonthly=true',
        );
      }
      if (phase.monthlyDay !== undefined) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'monthlyDay',
          'é inválido',
          'isContraceptiveMonthly=true',
        );
      }
      return;
    }

    if (hasMonthlySpecialFields) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'monthlySpecial*',
        'é inválido',
        'isContraceptiveMonthly=false',
      );
    }
  }

  private ensureManualAdjustmentCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    supportsManualAdjustment: boolean,
  ): void {
    if (phase.manualAdjustmentEnabled && !supportsManualAdjustment) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'manualAdjustmentEnabled=true',
        'é inválido',
        'supportsManualAdjustment=false',
      );
    }

    if (!phase.manualAdjustmentEnabled && phase.manualTimes !== undefined) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'manualTimes',
        'é inválido quando manualAdjustmentEnabled=false',
      );
    }
  }

  private throwMedicationDomainError(
    medicationId: string,
    message: string,
    capability?: string,
  ): never {
    const capabilitySuffix = capability ? ` (${capability}).` : '.';
    throw new UnprocessableEntityException(
      `Medicamento ${medicationId}: ${message}${capabilitySuffix}`,
    );
  }

  private throwPhaseDomainError(
    medicationId: string,
    phaseOrder: number,
    field: string,
    message: string,
    capability?: string,
  ): never {
    const capabilitySuffix = capability ? ` (${capability}).` : '.';
    throw new UnprocessableEntityException(
      `Fase ${phaseOrder}: ${field} ${message} para medicamento ${medicationId}${capabilitySuffix}`,
    );
  }
}

function medicationSnapshotFromEntity(
  medication: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>,
): ClinicalMedicationSnapshot {
  return {
    id: medication.id,
    commercialName: medication.commercialName,
    activePrinciple: medication.activePrinciple,
    presentation: medication.presentation,
    pharmaceuticalForm: medication.pharmaceuticalForm,
    administrationRoute: medication.administrationRoute,
    usageInstructions: medication.usageInstructions,
    diluentType: medication.diluentType,
    defaultAdministrationUnit: medication.defaultAdministrationUnit,
    supportsManualAdjustment: medication.supportsManualAdjustment,
    isOphthalmic: medication.isOphthalmic,
    isOtic: medication.isOtic,
    isContraceptiveMonthly: medication.isContraceptiveMonthly,
    requiresGlycemiaScale: medication.requiresGlycemiaScale,
    notes: medication.notes,
  };
}

function protocolSnapshotFromEntity(
  protocol: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>['protocols'][number],
): ClinicalProtocolSnapshot {
  return {
    id: protocol.id,
    code: protocol.code,
    name: protocol.name,
    description: protocol.description,
    groupCode: protocol.group.code,
    subgroupCode: protocol.subgroupCode,
    priority: protocol.priority,
    isDefault: protocol.isDefault,
    active: protocol.active,
    clinicalNotes: protocol.clinicalNotes,
    frequencies: protocol.frequencies.map((frequency) => ({
      frequency: frequency.frequency,
      label: frequency.label,
      allowedRecurrenceTypes: frequency.allowedRecurrenceTypes,
      allowsPrn: frequency.allowsPrn,
      allowsVariableDoseBySchedule: frequency.allowsVariableDoseBySchedule,
      steps: frequency.steps.map((step) => ({
        doseLabel: step.doseLabel,
        anchor: step.anchor,
        offsetMinutes: step.offsetMinutes,
        semanticTag: step.semanticTag,
      })),
    })),
  };
}

function interactionRulesSnapshotFromEntity(
  protocol: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>['protocols'][number],
): ClinicalInteractionRuleSnapshot[] {
  return protocol.interactionRules.map((rule) => ({
    interactionType: rule.interactionType,
    targetGroupCode: rule.targetGroupCode,
    targetProtocolCode: rule.targetProtocolCode,
    resolutionType: rule.resolutionType,
    windowMinutes: rule.windowMinutes,
    windowBeforeMinutes: rule.windowBeforeMinutes ?? rule.windowMinutes,
    windowAfterMinutes: rule.windowAfterMinutes ?? rule.windowMinutes,
    applicableSemanticTags: rule.applicableSemanticTags,
    priority: rule.priority,
  }));
}
