import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClinicalAnchor } from '../../common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../../common/enums/clinical-semantic-tag.enum';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import { calculateEndDate } from '../../common/utils/treatment-window.util';
import { hhmmToMinutes, minutesToHhmm } from '../../common/utils/time.util';
import { PatientService } from '../patients/patient.service';
import { PatientPrescriptionMedication } from '../patient-prescriptions/entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from '../patient-prescriptions/entities/patient-prescription-phase.entity';
import { PatientPrescription } from '../patient-prescriptions/entities/patient-prescription.entity';
import { ConflictResolutionService, ConflictEntryLike } from './services/conflict-resolution.service';
import {
  ScheduledPhaseDto,
  SchedulingResultDto,
  ScheduleEntryDto,
} from './dto/schedule-response.dto';
import { ScheduledDose } from './entities/scheduled-dose.entity';
import { SchedulingRulesService } from './services/scheduling-rules.service';

type ScheduleAnchors = Record<ClinicalAnchor, number>;

interface WorkingEntry extends ScheduleEntryDto, ConflictEntryLike {
  prescriptionMedication: PatientPrescriptionMedication;
  phase: PatientPrescriptionPhase;
  sourceClinicalMedicationId: string;
  sourceProtocolId: string;
  phaseOrder: number;
  protocolPriority: number;
}

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(ScheduledDose)
    private readonly scheduledDoseRepository: Repository<ScheduledDose>,
    @InjectRepository(PatientPrescription)
    private readonly prescriptionRepository: Repository<PatientPrescription>,
    private readonly patientService: PatientService,
    private readonly rulesService: SchedulingRulesService,
    private readonly conflictResolutionService: ConflictResolutionService,
  ) {}

  async buildAndPersistSchedule(
    prescription: PatientPrescription,
    entityManager?: EntityManager,
  ): Promise<SchedulingResultDto> {
    const anchors = await this.resolveScheduleAnchors(prescription);
    let entries = this.buildBaseEntries(prescription, anchors);
    entries = this.applyConflictRules(entries);
    entries = entries.map((entry) => ({
      ...entry,
      timeFormatted: minutesToHhmm(entry.timeInMinutes),
      timeContext: {
        ...entry.timeContext,
        resolvedTimeInMinutes: entry.timeInMinutes,
        resolvedTimeFormatted: minutesToHhmm(entry.timeInMinutes),
      },
    }));
    entries = this.sortEntries(entries);

    const persisted = await this.persistSchedule(prescription, entries, entityManager);
    return this.mapSchedulingResult(prescription, persisted);
  }

  async getScheduleByPrescription(prescriptionId: string): Promise<SchedulingResultDto> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }

    const scheduledDoses = await this.scheduledDoseRepository.find({
      where: { prescription: { id: prescriptionId } },
      relations: ['prescriptionMedication', 'phase'],
      order: { phaseOrder: 'ASC', timeInMinutes: 'ASC' },
    });

    return this.mapSchedulingResult(prescription, scheduledDoses);
  }

  private async resolveScheduleAnchors(
    prescription: PatientPrescription,
  ): Promise<ScheduleAnchors> {
    const routine = await this.patientService.getActiveRoutine(prescription.patient.id);
    return {
      [ClinicalAnchor.ACORDAR]: hhmmToMinutes(routine.acordar),
      [ClinicalAnchor.CAFE]: hhmmToMinutes(routine.cafe),
      [ClinicalAnchor.ALMOCO]: hhmmToMinutes(routine.almoco),
      [ClinicalAnchor.LANCHE]: hhmmToMinutes(routine.lanche),
      [ClinicalAnchor.JANTAR]: hhmmToMinutes(routine.jantar),
      [ClinicalAnchor.DORMIR]: hhmmToMinutes(routine.dormir),
      [ClinicalAnchor.MANUAL]: 0,
    };
  }

  private buildBaseEntries(
    prescription: PatientPrescription,
    anchors: ScheduleAnchors,
  ): WorkingEntry[] {
    const phases = [...prescription.medications]
      .sort((a, b) => a.medicationSnapshot.activePrinciple.localeCompare(b.medicationSnapshot.activePrinciple))
      .flatMap((medication) =>
        [...medication.phases]
          .sort((a, b) => a.phaseOrder - b.phaseOrder)
          .flatMap((phase) =>
            this.buildEntriesForPhase(
              prescription,
              medication,
              phase,
              anchors,
              this.computePhaseWindow(prescription.startedAt, medication, phase),
            ),
          ),
      );

    return phases;
  }

  private computePhaseWindow(
    prescriptionStartDate: string,
    medication: PatientPrescriptionMedication,
    phase: PatientPrescriptionPhase,
  ): { startDate: string; endDate?: string } {
    const sorted = [...medication.phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
    let currentStart = prescriptionStartDate;
    for (const currentPhase of sorted) {
      const currentEnd = currentPhase.continuousUse
        ? undefined
        : calculateEndDate(currentStart, currentPhase.treatmentDays ?? 1);
      if (currentPhase.phaseOrder === phase.phaseOrder) {
        return { startDate: currentStart, endDate: currentEnd };
      }
      if (!currentEnd) {
        return { startDate: currentStart, endDate: undefined };
      }
      currentStart = shiftDateByDays(currentEnd, 1);
    }
    return { startDate: prescriptionStartDate };
  }

  private buildEntriesForPhase(
    prescription: PatientPrescription,
    medication: PatientPrescriptionMedication,
    phase: PatientPrescriptionPhase,
    anchors: ScheduleAnchors,
    phaseWindow: { startDate: string; endDate?: string },
  ): WorkingEntry[] {
    if (phase.manualAdjustmentEnabled && phase.manualTimes?.length) {
      return phase.manualTimes.map((time, index) =>
        this.createEntry(
          prescription,
          medication,
          phase,
          `D${index + 1}`,
          hhmmToMinutes(time),
          ClinicalSemanticTag.STANDARD,
          ClinicalAnchor.MANUAL,
          hhmmToMinutes(time),
          0,
          phaseWindow,
          'Horário definido manualmente.',
        ),
      );
    }

    const frequencyConfig = this.rulesService.getFrequencyConfig(
      medication.protocolSnapshot,
      phase.frequency,
    );

    return frequencyConfig.steps.map((step) =>
      this.createEntry(
        prescription,
        medication,
        phase,
        step.doseLabel,
        anchors[step.anchor] + step.offsetMinutes,
        step.semanticTag,
        step.anchor,
        anchors[step.anchor],
        step.offsetMinutes,
        phaseWindow,
      ),
    );
  }

  private createEntry(
    prescription: PatientPrescription,
    medication: PatientPrescriptionMedication,
    phase: PatientPrescriptionPhase,
    doseLabel: string,
    timeInMinutes: number,
    semanticTag: ClinicalSemanticTag,
    anchor: ClinicalAnchor,
    anchorTimeInMinutes: number,
    offsetMinutes: number,
    phaseWindow: { startDate: string; endDate?: string },
    note?: string,
  ): WorkingEntry {
    const administration = this.resolveAdministration(phase, doseLabel);

    return {
      prescriptionMedication: medication,
      phase,
      sourceClinicalMedicationId: medication.sourceClinicalMedicationId,
      sourceProtocolId: medication.sourceProtocolId,
      phaseOrder: phase.phaseOrder,
      protocolPriority: medication.protocolSnapshot.priority,
      medicationName:
        medication.medicationSnapshot.commercialName ??
        medication.medicationSnapshot.activePrinciple,
      groupCode: medication.protocolSnapshot.groupCode,
      protocolCode: medication.protocolSnapshot.code,
      semanticTag,
      interactionRulesSnapshot: medication.interactionRulesSnapshot,
      phaseDoseLabel: doseLabel,
      doseLabel,
      administrationValue: administration.administrationValue,
      administrationUnit: administration.administrationUnit,
      administrationLabel: administration.administrationLabel,
      recurrenceType: phase.recurrenceType,
      recurrenceLabel: formatRecurrenceLabel(phase.recurrenceType, phaseWindow.startDate, phaseWindow.endDate, phase),
      startDate: phaseWindow.startDate,
      endDate: phaseWindow.endDate,
      weeklyDay: phase.weeklyDay,
      monthlyRule: phase.monthlyRule,
      monthlyDay: phase.monthlyDay,
      alternateDaysInterval: phase.alternateDaysInterval,
      continuousUse: phase.continuousUse,
      isPrn: phase.recurrenceType === TreatmentRecurrence.PRN,
      prnReason: phase.prnReason,
      clinicalInstructionLabel:
        phase.recurrenceType === TreatmentRecurrence.PRN
          ? phase.prnReason
            ? `Uso se necessario em caso de ${String(phase.prnReason).toLowerCase()}.`
            : 'Uso se necessario.'
          : undefined,
      timeInMinutes,
      timeFormatted: minutesToHhmm(timeInMinutes),
      timeContext: {
        anchor,
        anchorTimeInMinutes,
        offsetMinutes,
        semanticTag,
        originalTimeInMinutes: timeInMinutes,
        originalTimeFormatted: minutesToHhmm(timeInMinutes),
        resolvedTimeInMinutes: timeInMinutes,
        resolvedTimeFormatted: minutesToHhmm(timeInMinutes),
      },
      status: ScheduleStatus.ACTIVE,
      note,
    };
  }

  private resolveAdministration(
    phase: PatientPrescriptionPhase,
    doseLabel: string,
  ): {
    administrationValue?: string;
    administrationUnit?: string;
    administrationLabel: string;
  } {
    const override = phase.sameDosePerSchedule
      ? undefined
      : phase.perDoseOverrides?.find((item) => item.doseLabel === doseLabel);
    const administrationValue = override?.doseValue ?? phase.doseValue;
    const administrationUnit = override?.doseUnit ?? phase.doseUnit;
    if (administrationValue && administrationUnit) {
      return {
        administrationValue,
        administrationUnit,
        administrationLabel: `${administrationValue} ${administrationUnit}`,
      };
    }
    return {
      administrationValue,
      administrationUnit,
      administrationLabel: administrationValue ?? phase.doseAmount ?? doseLabel,
    };
  }

  private applyConflictRules(entries: WorkingEntry[]): WorkingEntry[] {
    const normalized = entries.map((entry) => ({ ...entry }));
    this.conflictResolutionService.apply(normalized);
    return normalized;
  }

  private sortEntries(entries: WorkingEntry[]): WorkingEntry[] {
    return [...entries].sort(
      (a, b) =>
        a.phaseOrder - b.phaseOrder ||
        a.timeInMinutes - b.timeInMinutes ||
        a.medicationName.localeCompare(b.medicationName),
    );
  }

  private async persistSchedule(
    prescription: PatientPrescription,
    entries: WorkingEntry[],
    entityManager?: EntityManager,
  ): Promise<ScheduledDose[]> {
    const scheduledDoseRepository =
      entityManager?.getRepository(ScheduledDose) ?? this.scheduledDoseRepository;

    await scheduledDoseRepository.delete({
      prescription: { id: prescription.id },
    });

    return scheduledDoseRepository.save(
      entries.map((entry) =>
        scheduledDoseRepository.create({
          prescription,
          prescriptionMedication: entry.prescriptionMedication,
          phase: entry.phase,
          phaseOrder: entry.phaseOrder,
          doseLabel: entry.doseLabel,
          administrationValue: entry.administrationValue,
          administrationUnit: entry.administrationUnit,
          administrationLabel: entry.administrationLabel,
          recurrenceType: entry.recurrenceType,
          startDate: entry.startDate,
          endDate: entry.endDate,
          weeklyDay: entry.weeklyDay,
          monthlyRule: entry.monthlyRule,
          monthlyDay: entry.monthlyDay,
          alternateDaysInterval: entry.alternateDaysInterval,
          continuousUse: entry.continuousUse,
          isPrn: entry.isPrn,
          prnReason: entry.prnReason,
          clinicalInstructionLabel: entry.clinicalInstructionLabel,
          timeInMinutes: entry.timeInMinutes,
          timeFormatted: entry.timeFormatted,
          anchor: entry.timeContext.anchor,
          anchorTimeInMinutes: entry.timeContext.anchorTimeInMinutes,
          offsetMinutes: entry.timeContext.offsetMinutes,
          semanticTag: entry.timeContext.semanticTag,
          originalTimeInMinutes: entry.timeContext.originalTimeInMinutes,
          originalTimeFormatted: entry.timeContext.originalTimeFormatted,
          status: entry.status,
          note: entry.note,
          conflictInteractionType: entry.conflict?.interactionType,
          conflictResolutionType: entry.conflict?.resolutionType,
          conflictTriggerMedicationName: entry.conflict?.triggerMedicationName,
          conflictTriggerGroupCode: entry.conflict?.triggerGroupCode,
          conflictTriggerProtocolCode: entry.conflict?.triggerProtocolCode,
          conflictRulePriority: entry.conflict?.rulePriority,
          conflictWindowBeforeMinutes: entry.conflict?.windowBeforeMinutes,
          conflictWindowAfterMinutes: entry.conflict?.windowAfterMinutes,
        }),
      ),
    );
  }

  private mapSchedulingResult(
    prescription: PatientPrescription,
    doses: ScheduledDose[],
  ): SchedulingResultDto {
    const medications = [...prescription.medications].sort((a, b) => {
      const leftName = a.medicationSnapshot.commercialName ?? a.medicationSnapshot.activePrinciple;
      const rightName = b.medicationSnapshot.commercialName ?? b.medicationSnapshot.activePrinciple;
      return leftName.localeCompare(rightName) || a.id.localeCompare(b.id);
    });

    return {
      patientId: prescription.patient.id,
      prescriptionId: prescription.id,
      medications: medications.map((medication) => ({
        prescriptionMedicationId: medication.id,
        sourceClinicalMedicationId: medication.sourceClinicalMedicationId,
        sourceProtocolId: medication.sourceProtocolId,
        medicationName:
          medication.medicationSnapshot.commercialName ??
          medication.medicationSnapshot.activePrinciple,
        activePrinciple: medication.medicationSnapshot.activePrinciple,
        presentation: medication.medicationSnapshot.presentation,
        pharmaceuticalForm: medication.medicationSnapshot.pharmaceuticalForm,
        administrationRoute: medication.medicationSnapshot.administrationRoute,
        usageInstructions: medication.medicationSnapshot.usageInstructions,
        diluentType: medication.medicationSnapshot.diluentType,
        defaultAdministrationUnit: medication.medicationSnapshot.defaultAdministrationUnit,
        supportsManualAdjustment: medication.medicationSnapshot.supportsManualAdjustment,
        isOphthalmic: medication.medicationSnapshot.isOphthalmic,
        isOtic: medication.medicationSnapshot.isOtic,
        isContraceptiveMonthly: medication.medicationSnapshot.isContraceptiveMonthly,
        requiresGlycemiaScale: medication.medicationSnapshot.requiresGlycemiaScale,
        notes: medication.medicationSnapshot.notes,
        groupCode: medication.protocolSnapshot.groupCode,
        subgroupCode: medication.protocolSnapshot.subgroupCode,
        protocolCode: medication.protocolSnapshot.code,
        protocolName: medication.protocolSnapshot.name,
        protocolDescription: medication.protocolSnapshot.description,
        clinicalNotes: medication.protocolSnapshot.clinicalNotes,
        phases: this.mapPhases(medication, doses),
      })),
    };
  }

  private mapPhases(
    medication: PatientPrescriptionMedication,
    doses: ScheduledDose[],
  ): ScheduledPhaseDto[] {
    return [...medication.phases]
      .sort((a, b) => a.phaseOrder - b.phaseOrder)
      .map((phase) => {
        const phaseEntries = doses
          .filter(
            (dose) =>
              dose.prescriptionMedication.id === medication.id &&
              dose.phase.id === phase.id,
          )
          .sort((a, b) => a.timeInMinutes - b.timeInMinutes)
          .map((dose) => ({
            doseLabel: dose.doseLabel,
            administrationValue: dose.administrationValue,
            administrationUnit: dose.administrationUnit,
            administrationLabel: dose.administrationLabel ?? dose.doseLabel,
            recurrenceType: dose.recurrenceType,
            recurrenceLabel: formatRecurrenceLabel(
              phase.recurrenceType,
              dose.startDate,
              dose.endDate,
              phase,
            ),
            startDate: dose.startDate,
            endDate: dose.endDate,
            weeklyDay: dose.weeklyDay,
            monthlyRule: dose.monthlyRule,
            monthlyDay: dose.monthlyDay,
            alternateDaysInterval: dose.alternateDaysInterval,
            continuousUse: dose.continuousUse,
            isPrn: dose.isPrn,
            prnReason: dose.prnReason,
            clinicalInstructionLabel: dose.clinicalInstructionLabel,
            timeInMinutes: dose.timeInMinutes,
            timeFormatted: dose.timeFormatted,
            timeContext: {
              anchor: dose.anchor,
              anchorTimeInMinutes: dose.anchorTimeInMinutes,
              offsetMinutes: dose.offsetMinutes,
              semanticTag: dose.semanticTag,
              originalTimeInMinutes: dose.originalTimeInMinutes,
              originalTimeFormatted: dose.originalTimeFormatted,
              resolvedTimeInMinutes: dose.timeInMinutes,
              resolvedTimeFormatted: dose.timeFormatted,
            },
            status: dose.status,
            note: dose.note,
            conflict:
              dose.conflictInteractionType || dose.conflictResolutionType
                ? {
                    interactionType: dose.conflictInteractionType,
                    resolutionType: dose.conflictResolutionType,
                    triggerMedicationName: dose.conflictTriggerMedicationName,
                    triggerGroupCode: dose.conflictTriggerGroupCode,
                    triggerProtocolCode: dose.conflictTriggerProtocolCode,
                    rulePriority: dose.conflictRulePriority,
                    windowBeforeMinutes: dose.conflictWindowBeforeMinutes,
                    windowAfterMinutes: dose.conflictWindowAfterMinutes,
                  }
                : undefined,
          }));

        return {
          phaseOrder: phase.phaseOrder,
          recurrenceType: phase.recurrenceType,
          recurrenceLabel: phaseEntries[0]?.recurrenceLabel,
          startDate: phaseEntries[0]?.startDate,
          endDate: phaseEntries[0]?.endDate,
          continuousUse: phase.continuousUse,
          entries: phaseEntries,
        };
      });
  }
}

function formatRecurrenceLabel(
  recurrenceType: TreatmentRecurrence,
  startDate: string | undefined,
  endDate: string | undefined,
  phase: PatientPrescriptionPhase,
): string {
  if (phase.continuousUse) {
    return 'Uso continuo';
  }

  switch (recurrenceType) {
    case TreatmentRecurrence.WEEKLY:
      return phase.weeklyDay ? `Semanal em ${phase.weeklyDay}` : 'Semanal';
    case TreatmentRecurrence.MONTHLY:
      if (phase.monthlyDay) return `Mensal no dia ${phase.monthlyDay}`;
      return phase.monthlyRule ? `Mensal: ${phase.monthlyRule}` : 'Mensal';
    case TreatmentRecurrence.ALTERNATE_DAYS:
      return `A cada ${phase.alternateDaysInterval ?? 2} dias`;
    case TreatmentRecurrence.PRN:
      return phase.prnReason
        ? `Se necessario: ${String(phase.prnReason).toLowerCase()}`
        : 'Se necessario';
    case TreatmentRecurrence.DAILY:
    default:
      if (!startDate) return 'Diario';
      return endDate ? 'Diario' : phase.continuousUse ? 'Uso continuo' : 'Diario';
  }
}

function shiftDateByDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const resultYear = String(date.getFullYear());
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  return `${resultYear}-${resultMonth}-${resultDay}`;
}
