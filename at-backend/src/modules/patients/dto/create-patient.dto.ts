import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  fullName: string;

  @IsDateString()
  birthDate: string;

  @IsOptional()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
