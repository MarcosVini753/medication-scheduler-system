import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';

export interface ScheduleEntryDto {
  medicationId: string;
  medicationName: string;
  groupCode: string;
  doseLabel: string;
  administrationValue?: string;
  administrationUnit?: string;
  administrationLabel: string;
  recurrenceType?: TreatmentRecurrence;
  startDate?: string;
  endDate?: string;
  weeklyDay?: string;
  monthlyDay?: number;
  alternateDaysInterval?: number;
  continuousUse: boolean;
  prnReason?: PrnReason;
  timeInMinutes: number;
  timeFormatted: string;
  status: string;
  note?: string;
}

export interface SchedulingResultDto {
  patientId: string;
  prescriptionId: string;
  entries: ScheduleEntryDto[];
}
