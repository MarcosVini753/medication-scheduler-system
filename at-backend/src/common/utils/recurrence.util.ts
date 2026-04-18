import { BadRequestException } from '@nestjs/common';
import { PrnReason } from '../enums/prn-reason.enum';
import { TreatmentRecurrence } from '../enums/treatment-recurrence.enum';
import { Prescription } from '../../modules/prescriptions/entities/prescription.entity';
import { PrescriptionItem } from '../../modules/prescriptions/entities/prescription-item.entity';
import { calculateEndDate } from './treatment-window.util';

export interface RecurrenceMetadata {
  recurrenceType: TreatmentRecurrence;
  startDate: string;
  endDate?: string;
  weeklyDay?: string;
  monthlyDay?: number;
  alternateDaysInterval?: number;
  continuousUse: boolean;
  prnReason?: PrnReason;
}

export function buildRecurrenceMetadata(
  item: PrescriptionItem,
  prescription: Prescription,
): RecurrenceMetadata {
  const recurrenceType = item.recurrenceType ?? TreatmentRecurrence.DAILY;
  const monthlyDay = validateMonthlyDay(item.monthlyDay);

  return {
    recurrenceType,
    startDate: prescription.startedAt,
    endDate: item.continuousUse
      ? undefined
      : calculateEndDate(prescription.startedAt, item.treatmentDays),
    weeklyDay: normalizeWeeklyDay(item.weeklyDay),
    monthlyDay,
    alternateDaysInterval:
      recurrenceType === TreatmentRecurrence.ALTERNATE_DAYS
        ? item.alternateDaysInterval ?? 2
        : undefined,
    continuousUse: item.continuousUse,
    prnReason:
      recurrenceType === TreatmentRecurrence.PRN ? item.prnReason : undefined,
  };
}

export function normalizeWeeklyDay(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : undefined;
}

export function validateMonthlyDay(value?: number): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new BadRequestException('monthlyDay deve estar entre 1 e 31.');
  }

  return value;
}

export function formatClinicalRecurrenceLabel(metadata: RecurrenceMetadata): string {
  if (metadata.continuousUse) {
    return 'Uso continuo';
  }

  switch (metadata.recurrenceType) {
    case TreatmentRecurrence.ALTERNATE_DAYS:
      return `A cada ${metadata.alternateDaysInterval ?? 2} dias`;
    case TreatmentRecurrence.WEEKLY:
      return metadata.weeklyDay ? `Semanal em ${metadata.weeklyDay}` : 'Semanal';
    case TreatmentRecurrence.MONTHLY:
      return metadata.monthlyDay ? `Mensal no dia ${metadata.monthlyDay}` : 'Mensal';
    case TreatmentRecurrence.PRN:
      return metadata.prnReason ? `Se necessario: ${metadata.prnReason}` : 'Se necessario';
    case TreatmentRecurrence.DAILY:
    default:
      return 'Diario';
  }
}
