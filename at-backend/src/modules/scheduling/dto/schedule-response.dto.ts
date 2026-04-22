import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';

export interface ResolvedScheduleTimeContextDto {
  anchor?: ClinicalAnchor;
  anchorTimeInMinutes?: number;
  offsetMinutes?: number;
  semanticTag?: ClinicalSemanticTag;
  originalTimeInMinutes: number;
  originalTimeFormatted: string;
  resolvedTimeInMinutes: number;
  resolvedTimeFormatted: string;
}

export interface ScheduleConflictDto {
  interactionType?: ClinicalInteractionType;
  resolutionType?: ClinicalResolutionType;
  triggerMedicationName?: string;
  triggerGroupCode?: string;
  triggerProtocolCode?: string;
  rulePriority?: number;
  windowBeforeMinutes?: number;
  windowAfterMinutes?: number;
}

export interface ScheduleEntryDto {
  doseLabel: string;
  administrationValue?: string;
  administrationUnit?: string;
  administrationLabel: string;
  recurrenceType?: TreatmentRecurrence;
  recurrenceLabel?: string;
  startDate?: string;
  endDate?: string;
  weeklyDay?: string;
  monthlyRule?: string;
  monthlyDay?: number;
  alternateDaysInterval?: number;
  continuousUse: boolean;
  isPrn: boolean;
  prnReason?: PrnReason;
  clinicalInstructionLabel?: string;
  timeInMinutes: number;
  timeFormatted: string;
  timeContext: ResolvedScheduleTimeContextDto;
  status: string;
  note?: string;
  conflict?: ScheduleConflictDto;
}

export interface ScheduledPhaseDto {
  phaseOrder: number;
  recurrenceType?: TreatmentRecurrence;
  recurrenceLabel?: string;
  startDate?: string;
  endDate?: string;
  continuousUse: boolean;
  entries: ScheduleEntryDto[];
}

export interface ScheduledMedicationDto {
  prescriptionMedicationId: string;
  sourceClinicalMedicationId: string;
  sourceProtocolId: string;
  medicationName: string;
  activePrinciple: string;
  presentation: string;
  pharmaceuticalForm?: string;
  administrationRoute: string;
  usageInstructions: string;
  diluentType?: string;
  defaultAdministrationUnit?: string;
  supportsManualAdjustment?: boolean;
  isOphthalmic?: boolean;
  isOtic?: boolean;
  isContraceptiveMonthly?: boolean;
  requiresGlycemiaScale?: boolean;
  notes?: string;
  groupCode: string;
  subgroupCode?: string;
  protocolCode: string;
  protocolName?: string;
  protocolDescription?: string;
  clinicalNotes?: string;
  phases: ScheduledPhaseDto[];
}

export interface SchedulingResultDto {
  patientId: string;
  prescriptionId: string;
  medications: ScheduledMedicationDto[];
}
