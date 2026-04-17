import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMedicationDto {
  @IsOptional()
  @IsString()
  commercialName?: string;

  @IsString()
  activePrinciple: string;

  @IsString()
  presentation: string;

  @IsString()
  administrationRoute: string;

  @IsString()
  usageInstructions: string;

  @IsBoolean()
  interferesWithSalts: boolean;

  @IsUUID()
  groupId: string;
}
