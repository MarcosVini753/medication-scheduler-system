import { Injectable } from '@nestjs/common';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { ScheduleStatus } from '../../../common/enums/schedule-status.enum';
import { MealAnchor } from '../../../common/enums/meal-anchor.enum';
import {
  ClinicalInteractionRuleSnapshot,
} from '../../patient-prescriptions/entities/patient-prescription-snapshot.types';

export interface ConflictEntryLike {
  medicationName: string;
  groupCode: string;
  protocolCode: string;
  timeInMinutes: number;
  status: string;
  note?: string;
  semanticTag: ClinicalSemanticTag;
  interactionRulesSnapshot: ClinicalInteractionRuleSnapshot[];
  phaseDoseLabel: string;
}

@Injectable()
export class ConflictResolutionService {
  applySaltRule(entries: ConflictEntryLike[]): void {
    const saltEntries = entries.filter(
      (entry) =>
        entry.groupCode === 'GROUP_III_SAL' &&
        entry.status === ScheduleStatus.ACTIVE,
    );

    saltEntries.forEach((saltEntry) => {
      const conflict = entries.find(
        (entry) =>
          entry !== saltEntry &&
          entry.status === ScheduleStatus.ACTIVE &&
          entry.timeInMinutes === saltEntry.timeInMinutes &&
          this.isAffectedBy(entry, ClinicalInteractionType.AFFECTED_BY_SALTS, saltEntry),
      );
      if (conflict) {
        saltEntry.status = ScheduleStatus.INACTIVE;
        saltEntry.note = `Dose inativada por conflito com ${conflict.medicationName}.`;
      }
    });
  }

  applyCalciumRule(entries: ConflictEntryLike[]): void {
    const calciumEntries = entries.filter(
      (entry) =>
        entry.groupCode === 'GROUP_III_CALC' &&
        entry.status === ScheduleStatus.ACTIVE,
    );

    calciumEntries.forEach((calciumEntry) => {
      const conflict = entries.find(
        (entry) =>
          entry !== calciumEntry &&
          entry.status === ScheduleStatus.ACTIVE &&
          entry.timeInMinutes === calciumEntry.timeInMinutes &&
          this.findMatchingRule(
            entry,
            ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            calciumEntry,
          ),
      );
      if (!conflict) return;

      const matchingRule = this.findMatchingRule(
        conflict,
        ClinicalInteractionType.AFFECTED_BY_CALCIUM,
        calciumEntry,
      );
      if (!matchingRule) return;

      if (matchingRule.resolutionType === ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT) {
        calciumEntry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
        calciumEntry.note = `Cálcio exige ajuste manual por conflito com ${conflict.medicationName}.`;
        return;
      }

      if (matchingRule.resolutionType === ClinicalResolutionType.INACTIVATE_SOURCE) {
        calciumEntry.status = ScheduleStatus.INACTIVE;
        calciumEntry.note = `Dose inativada por conflito com ${conflict.medicationName}.`;
        return;
      }

      const windowMinutes = matchingRule.windowMinutes ?? 60;
      calciumEntry.timeInMinutes += windowMinutes;
      calciumEntry.note = `Cálcio deslocado ${windowMinutes} minuto(s) por interferência com ${conflict.medicationName}.`;

      const persistentConflict = entries.find(
        (entry) =>
          entry !== calciumEntry &&
          entry.status === ScheduleStatus.ACTIVE &&
          entry.timeInMinutes === calciumEntry.timeInMinutes &&
          this.findMatchingRule(
            entry,
            ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            calciumEntry,
          ),
      );
      if (persistentConflict) {
        calciumEntry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
        calciumEntry.note = `Cálcio exige ajuste manual após conflito persistente com ${persistentConflict.medicationName}.`;
      }
    });
  }

  applySucralfateRule(
    entries: ConflictEntryLike[],
    anchors: Record<MealAnchor, number>,
  ): void {
    const sucralfateEntries = entries.filter(
      (entry) =>
        entry.groupCode === 'GROUP_II_SUCRA' &&
        entry.status === ScheduleStatus.ACTIVE,
    );

    sucralfateEntries.forEach((entry) => {
      const isBedtimeDose = entry.timeInMinutes === anchors[MealAnchor.DORMIR];
      if (isBedtimeDose) {
        const bedtimeConflict = entries.find(
          (other) =>
            other !== entry &&
            other.status === ScheduleStatus.ACTIVE &&
            this.isBedtimeEquivalentConflict(other, entry, anchors[MealAnchor.DORMIR]),
        );
        if (bedtimeConflict) {
          entry.status = ScheduleStatus.INACTIVE;
          entry.note = `Sucralfato inativado por conflito com ${bedtimeConflict.medicationName}.`;
        }
        return;
      }

      const currentConflict = entries.some(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === entry.timeInMinutes,
      );
      if (!currentConflict) return;

      const alternative = anchors[MealAnchor.ALMOCO] + 120;
      const alternativeConflict = entries.some(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === alternative,
      );
      if (!alternativeConflict) {
        entry.timeInMinutes = alternative;
        entry.note = 'Sucralfato deslocado para almoço + 2h por conflito no horário principal.';
        return;
      }

      entry.status = ScheduleStatus.INACTIVE;
      entry.note = 'Sucralfato inativado por conflito no horário principal e no alternativo.';
    });
  }

  private isAffectedBy(
    targetEntry: ConflictEntryLike,
    interactionType: ClinicalInteractionType,
    sourceEntry: ConflictEntryLike,
  ): boolean {
    return Boolean(this.findMatchingRule(targetEntry, interactionType, sourceEntry));
  }

  private isBedtimeEquivalentConflict(
    targetEntry: ConflictEntryLike,
    sourceEntry: ConflictEntryLike,
    bedtimeMinutes: number,
  ): boolean {
    const matchingRule = this.findMatchingRule(
      targetEntry,
      ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
      sourceEntry,
    );
    if (!matchingRule) return false;

    if (targetEntry.timeInMinutes === bedtimeMinutes) {
      return true;
    }

    if (targetEntry.semanticTag !== ClinicalSemanticTag.BEDTIME_EQUIVALENT) {
      return false;
    }

    const windowMinutes = matchingRule.windowMinutes ?? 20;
    return Math.abs(targetEntry.timeInMinutes - bedtimeMinutes) <= windowMinutes;
  }

  private findMatchingRule(
    targetEntry: ConflictEntryLike,
    interactionType: ClinicalInteractionType,
    sourceEntry: ConflictEntryLike,
  ): ClinicalInteractionRuleSnapshot | undefined {
    return targetEntry.interactionRulesSnapshot.find(
      (rule) =>
        rule.interactionType === interactionType &&
        (rule.targetGroupCode === undefined || rule.targetGroupCode === sourceEntry.groupCode) &&
        (rule.targetProtocolCode === undefined || rule.targetProtocolCode === sourceEntry.protocolCode) &&
        [
          ClinicalResolutionType.INACTIVATE_SOURCE,
          ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
          ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
        ].includes(rule.resolutionType),
    );
  }
}
