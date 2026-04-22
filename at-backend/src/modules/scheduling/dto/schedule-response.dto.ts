import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';

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
  status: string;
  note?: string;
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
  administrationRoute: string;
  usageInstructions: string;
  groupCode: string;
  protocolCode: string;
  phases: ScheduledPhaseDto[];
}

export interface SchedulingResultDto {
  patientId: string;
  prescriptionId: string;
  medications: ScheduledMedicationDto[];
}
