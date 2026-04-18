import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { GroupCode } from '../../../common/enums/group-code.enum';
import { MealAnchor } from '../../../common/enums/meal-anchor.enum';

export interface FormulaStep {
  doseLabel: string;
  base: MealAnchor;
  offsetMinutes: number;
}

@Injectable()
export class SchedulingRulesService {
  getFormula(groupCode: string, frequency: number): FormulaStep[] {
    const recipes: Record<string, Record<number, FormulaStep[]>> = {
      [GroupCode.GROUP_I]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)],
        2: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.JANTAR, 0)],
        3: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.LANCHE, 0), this.step('D3', MealAnchor.DORMIR, 0)],
        4: [
          this.step('D1', MealAnchor.ACORDAR, 0),
          this.step('D2', MealAnchor.ACORDAR, 360),
          this.step('D3', MealAnchor.ACORDAR, 720),
          this.step('D4', MealAnchor.ACORDAR, 1080)
        ]
      },
      [GroupCode.GROUP_II]: {
        1: [this.step('D1', MealAnchor.ACORDAR, 0)],
        2: [this.step('D1', MealAnchor.ACORDAR, 0), this.step('D2', MealAnchor.JANTAR, -60)],
        3: [this.step('D1', MealAnchor.ACORDAR, 0), this.step('D2', MealAnchor.LANCHE, -60), this.step('D3', MealAnchor.DORMIR, 0)]
      },
      [GroupCode.GROUP_II_BIFOS]: {
        1: [this.step('D1', MealAnchor.ACORDAR, -60)]
      },
      [GroupCode.GROUP_III_LAX]: {
        1: [this.step('D1', MealAnchor.CAFE, 120)],
        2: [this.step('D1', MealAnchor.CAFE, 120), this.step('D2', MealAnchor.DORMIR, 0)]
      },
      [GroupCode.GROUP_II_SUCRA]: {
        1: [this.step('D1', MealAnchor.ACORDAR, 120)],
        2: [this.step('D1', MealAnchor.ACORDAR, 120), this.step('D2', MealAnchor.DORMIR, 0)]
      },
      [GroupCode.GROUP_III_SAL]: {
        1: [this.step('D1', MealAnchor.ALMOCO, 120)],
        2: [this.step('D1', MealAnchor.CAFE, 120), this.step('D2', MealAnchor.DORMIR, 0)],
        3: [this.step('D1', MealAnchor.CAFE, 120), this.step('D2', MealAnchor.ALMOCO, 120), this.step('D3', MealAnchor.DORMIR, 0)]
      },
      [GroupCode.GROUP_III_ESTAT]: {
        1: [this.step('D1', MealAnchor.JANTAR, 0)]
      },
      [GroupCode.GROUP_III_DIU]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)],
        2: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.LANCHE, 0)]
      },
      [GroupCode.GROUP_III_MET]: {
        1: [this.step('D1', MealAnchor.JANTAR, 0)],
        2: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.JANTAR, 0)],
        3: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.ALMOCO, 0), this.step('D3', MealAnchor.JANTAR, 0)]
      },
      [GroupCode.GROUP_III_SUL]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)],
        2: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.JANTAR, 0)],
        3: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.ALMOCO, 0), this.step('D3', MealAnchor.JANTAR, 0)]
      },
      [GroupCode.GROUP_III_SUL2]: {
        1: [this.step('D1', MealAnchor.CAFE, -30)],
        2: [this.step('D1', MealAnchor.CAFE, -30), this.step('D2', MealAnchor.JANTAR, -30)],
        3: [this.step('D1', MealAnchor.CAFE, -30), this.step('D2', MealAnchor.ALMOCO, -30), this.step('D3', MealAnchor.JANTAR, -30)]
      },
      [GroupCode.GROUP_III_PROC]: {
        1: [this.step('D1', MealAnchor.CAFE, -20)],
        2: [this.step('D1', MealAnchor.CAFE, -20), this.step('D2', MealAnchor.JANTAR, -20)],
        3: [this.step('D1', MealAnchor.CAFE, -20), this.step('D2', MealAnchor.ALMOCO, -20), this.step('D3', MealAnchor.JANTAR, -20)]
      },
      [GroupCode.GROUP_I_SED]: {
        1: [this.step('D1', MealAnchor.DORMIR, -20)]
      },
      [GroupCode.GROUP_III_CALC]: {
        1: [this.step('D1', MealAnchor.CAFE, 180)],
        2: [this.step('D1', MealAnchor.CAFE, 180), this.step('D2', MealAnchor.DORMIR, 0)]
      },
      [GroupCode.GROUP_III_FER]: {
        1: [this.step('D1', MealAnchor.ALMOCO, -30)]
      },
      [GroupCode.GROUP_III]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)],
        2: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.JANTAR, 0)],
        3: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.LANCHE, 0), this.step('D3', MealAnchor.JANTAR, 0)]
      },
      [GroupCode.GROUP_DELTA]: {
        1: [this.step('D1', MealAnchor.ACORDAR, 0)],
        2: [this.step('D1', MealAnchor.ACORDAR, 0), this.step('D2', MealAnchor.ACORDAR, 720)],
        3: [this.step('D1', MealAnchor.ACORDAR, 0), this.step('D2', MealAnchor.ACORDAR, 480), this.step('D3', MealAnchor.DORMIR, 0)],
        4: [
          this.step('D1', MealAnchor.ACORDAR, 0),
          this.step('D2', MealAnchor.ACORDAR, 360),
          this.step('D3', MealAnchor.ACORDAR, 720),
          this.step('D4', MealAnchor.ACORDAR, 1080)
        ]
      },
      [GroupCode.GROUP_INSUL_ULTRA]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)],
        2: [this.step('D1', MealAnchor.CAFE, -10), this.step('D2', MealAnchor.JANTAR, -10)],
        3: [this.step('D1', MealAnchor.CAFE, -10), this.step('D2', MealAnchor.LANCHE, -10), this.step('D3', MealAnchor.JANTAR, -10)],
        4: [this.step('D1', MealAnchor.CAFE, -10), this.step('D2', MealAnchor.ALMOCO, -10), this.step('D3', MealAnchor.LANCHE, -10), this.step('D4', MealAnchor.JANTAR, -10)]
      },
      [GroupCode.GROUP_INSUL_RAPIDA]: {
        1: [this.step('D1', MealAnchor.CAFE, -30)],
        2: [this.step('D1', MealAnchor.CAFE, -30), this.step('D2', MealAnchor.JANTAR, -30)],
        3: [this.step('D1', MealAnchor.CAFE, -30), this.step('D2', MealAnchor.LANCHE, -30), this.step('D3', MealAnchor.JANTAR, -30)],
        4: [this.step('D1', MealAnchor.CAFE, -30), this.step('D2', MealAnchor.ALMOCO, -30), this.step('D3', MealAnchor.LANCHE, -30), this.step('D4', MealAnchor.JANTAR, -30)]
      },
      [GroupCode.GROUP_INSUL_INTER]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)],
        2: [this.step('D1', MealAnchor.CAFE, 0), this.step('D2', MealAnchor.JANTAR, 0)]
      },
      [GroupCode.GROUP_INSUL_LONGA]: {
        1: [this.step('D1', MealAnchor.CAFE, 0)]
      }
    };

    const formula = recipes[groupCode]?.[frequency];
    if (!formula) {
      throw new UnprocessableEntityException(
        `Fórmula não cadastrada para grupo ${groupCode} e frequência ${frequency}.`,
      );
    }
    return formula;
  }

  private step(doseLabel: string, base: MealAnchor, offsetMinutes: number): FormulaStep {
    return { doseLabel, base, offsetMinutes };
  }
}
