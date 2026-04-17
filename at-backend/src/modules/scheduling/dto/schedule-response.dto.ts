export interface ScheduleEntryDto {
  medicationId: string;
  medicationName: string;
  groupCode: string;
  doseLabel: string;
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
