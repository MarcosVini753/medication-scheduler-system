import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';

export class CreatePrescriptionItemDoseOverrideDto {
  @IsString()
  @Matches(/^D\d+$/)
  doseLabel: string;

  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseValue: string;

  @IsEnum(DoseUnit)
  doseUnit: DoseUnit;
}

export class CreatePrescriptionItemDto {
  @IsUUID()
  medicationId: string;

  @Type(() => Number)
  @IsInt()
  frequency: number;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseAmount?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseValue?: string;

  @IsOptional()
  @IsEnum(DoseUnit)
  doseUnit?: DoseUnit;

  @IsBoolean()
  sameDosePerSchedule: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDoseOverrideDto)
  perDoseOverrides?: CreatePrescriptionItemDoseOverrideDto[];

  @IsOptional()
  @IsEnum(TreatmentRecurrence)
  recurrenceType?: TreatmentRecurrence;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  alternateDaysInterval?: number;

  @IsOptional()
  @IsString()
  weeklyDay?: string;

  @IsOptional()
  @IsString()
  monthlyRule?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  monthlyDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  treatmentDays?: number;

  @IsBoolean()
  continuousUse: boolean;

  @IsOptional()
  @IsEnum(PrnReason)
  prnReason?: PrnReason;

  @IsBoolean()
  manualAdjustmentEnabled: boolean;

  @IsOptional()
  @IsArray()
  @Matches(/^\d{2}:\d{2}$/, { each: true })
  manualTimes?: string[];

  @IsOptional()
  @IsBoolean()
  dailyTreatment?: boolean;

  @IsOptional()
  @IsBoolean()
  crisisOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  feverOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  painOnly?: boolean;
}

export class CreatePrescriptionDto {
  @IsUUID()
  patientId: string;

  @IsDateString()
  startedAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}
