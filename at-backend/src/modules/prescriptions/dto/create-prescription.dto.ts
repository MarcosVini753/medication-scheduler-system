import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

export class CreatePrescriptionItemDto {
  @IsUUID()
  medicationId: string;

  @IsInt()
  frequency: number;

  @IsString()
  doseAmount: string;

  @IsBoolean()
  sameDosePerSchedule: boolean;

  @IsBoolean()
  dailyTreatment: boolean;

  @IsOptional()
  @IsString()
  weeklyDay?: string;

  @IsOptional()
  @IsString()
  monthlyRule?: string;

  @IsOptional()
  @IsInt()
  treatmentDays?: number;

  @IsBoolean()
  continuousUse: boolean;

  @IsBoolean()
  crisisOnly: boolean;

  @IsBoolean()
  feverOnly: boolean;

  @IsBoolean()
  painOnly: boolean;

  @IsBoolean()
  manualAdjustmentEnabled: boolean;

  @IsOptional()
  @IsArray()
  @Matches(/^\d{2}:\d{2}$/, { each: true })
  manualTimes?: string[];
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
