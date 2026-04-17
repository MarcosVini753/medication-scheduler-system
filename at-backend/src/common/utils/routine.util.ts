import { BadRequestException } from '@nestjs/common';
import { MealAnchor } from '../enums/meal-anchor.enum';

export interface RoutineClockMap {
  [MealAnchor.ACORDAR]: number;
  [MealAnchor.CAFE]: number;
  [MealAnchor.ALMOCO]: number;
  [MealAnchor.LANCHE]: number;
  [MealAnchor.JANTAR]: number;
  [MealAnchor.DORMIR]: number;
}

export function validateRoutine(routine: RoutineClockMap): void {
  if (routine[MealAnchor.CAFE] - routine[MealAnchor.ACORDAR] < 60) {
    throw new BadRequestException('Café da manhã deve ocorrer pelo menos 1 hora após acordar.');
  }
  if (routine[MealAnchor.ALMOCO] - routine[MealAnchor.CAFE] < 240) {
    throw new BadRequestException('Almoço deve ocorrer pelo menos 4 horas após o café da manhã.');
  }
  if (routine[MealAnchor.LANCHE] - routine[MealAnchor.ALMOCO] < 180) {
    throw new BadRequestException('Lanche deve ocorrer pelo menos 3 horas após o almoço.');
  }
  if (routine[MealAnchor.JANTAR] - routine[MealAnchor.LANCHE] < 180) {
    throw new BadRequestException('Jantar deve ocorrer pelo menos 3 horas após o lanche.');
  }
  if (routine[MealAnchor.DORMIR] - routine[MealAnchor.JANTAR] < 120) {
    throw new BadRequestException('Dormir deve ocorrer pelo menos 2 horas após o jantar.');
  }
}
