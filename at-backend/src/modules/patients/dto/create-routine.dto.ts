import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateRoutineDto {
  @Matches(/^\d{2}:\d{2}$/)
  acordar: string;

  @Matches(/^\d{2}:\d{2}$/)
  cafe: string;

  @Matches(/^\d{2}:\d{2}$/)
  almoco: string;

  @Matches(/^\d{2}:\d{2}$/)
  lanche: string;

  @Matches(/^\d{2}:\d{2}$/)
  jantar: string;

  @Matches(/^\d{2}:\d{2}$/)
  dormir: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
