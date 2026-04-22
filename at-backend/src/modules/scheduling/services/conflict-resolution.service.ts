import { Injectable } from '@nestjs/common';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { ScheduleStatus } from '../../../common/enums/schedule-status.enum';
import { ClinicalInteractionRuleSnapshot } from '../../patient-prescriptions/entities/patient-prescription-snapshot.types';
import { ScheduleConflictDto, ResolvedScheduleTimeContextDto } from '../dto/schedule-response.dto';

export interface ConflictEntryLike {
  medicationName: string;
  groupCode: string;
  protocolCode: string;
  protocolPriority: number;
  timeInMinutes: number;
  status: string;
  note?: string;
  semanticTag: ClinicalSemanticTag;
  interactionRulesSnapshot: ClinicalInteractionRuleSnapshot[];
  phaseDoseLabel: string;
  timeContext: ResolvedScheduleTimeContextDto;
  conflict?: ScheduleConflictDto;
}

interface RuleImpact {
  sourceEntry: ConflictEntryLike;
  targetEntry: ConflictEntryLike;
  rule: ClinicalInteractionRuleSnapshot;
  sortPriority: number;
}

@Injectable()
export class ConflictResolutionService {
  apply(
    entries: ConflictEntryLike[],
    anchors: Record<ClinicalAnchor, number>,
  ): void {
    this.applyInteractionRules(entries);
    this.applySucralfateProtocolFallback(entries, anchors);
  }

  private applyInteractionRules(entries: ConflictEntryLike[]): void {
    const activeEntries = entries.filter((entry) => entry.status === ScheduleStatus.ACTIVE);
    const impacts = activeEntries
      .flatMap((sourceEntry) => this.collectImpactsForSource(sourceEntry, activeEntries))
      .sort((left, right) =>
        right.sortPriority - left.sortPriority ||
        right.targetEntry.protocolPriority - left.targetEntry.protocolPriority ||
        left.targetEntry.medicationName.localeCompare(right.targetEntry.medicationName),
      );

    const bestImpactBySource = new Map<ConflictEntryLike, RuleImpact>();
    impacts.forEach((impact) => {
      if (!bestImpactBySource.has(impact.sourceEntry)) {
        bestImpactBySource.set(impact.sourceEntry, impact);
      }
    });

    for (const [entry, impact] of bestImpactBySource.entries()) {
      this.applyImpact(entry, impact, entries);
    }
  }

  private collectImpactsForSource(
    sourceEntry: ConflictEntryLike,
    entries: ConflictEntryLike[],
  ): RuleImpact[] {
    return entries
      .filter((targetEntry) => targetEntry !== sourceEntry)
      .flatMap((targetEntry) =>
        targetEntry.interactionRulesSnapshot
          .filter((rule) => this.isSupportedResolution(rule))
          .filter((rule) => this.matchesRule(targetEntry, sourceEntry, rule))
          .map((rule) => ({
            sourceEntry,
            targetEntry,
            rule,
            sortPriority: rule.priority ?? 0,
          })),
      );
  }

  private applyImpact(
    entry: ConflictEntryLike,
    impact: RuleImpact,
    entries: ConflictEntryLike[],
  ): void {
    entry.conflict = this.buildConflict(impact);

    if (impact.rule.resolutionType === ClinicalResolutionType.INACTIVATE_SOURCE) {
      entry.status = ScheduleStatus.INACTIVE;
      entry.note = `Dose inativada por conflito com ${impact.targetEntry.medicationName}.`;
      return;
    }

    if (
      impact.rule.resolutionType ===
      ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT
    ) {
      entry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
      entry.note = `ajuste manual exigido por conflito com ${impact.targetEntry.medicationName}.`;
      return;
    }

    const shiftWindow = this.resolveShiftWindow(impact.rule);
    entry.timeInMinutes += shiftWindow;
    entry.note = `Dose deslocada ${shiftWindow} minuto(s) por interferência com ${impact.targetEntry.medicationName}.`;

    const persistentImpacts = entries
      .filter((candidate) => candidate !== entry && candidate.status === ScheduleStatus.ACTIVE)
      .flatMap((targetEntry) =>
        targetEntry.interactionRulesSnapshot
          .filter((rule) => this.isSupportedResolution(rule))
          .filter((rule) => this.matchesRuleAtResolvedSlot(targetEntry, entry, rule))
          .map((rule) => ({
            sourceEntry: entry,
            targetEntry,
            rule,
            sortPriority: rule.priority ?? 0,
          })),
      )
      .sort((left, right) => right.sortPriority - left.sortPriority);

    if (persistentImpacts.length > 0) {
      const persistentImpact = persistentImpacts[0];
      entry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
      entry.note = `ajuste manual exigido após conflito persistente com ${persistentImpact.targetEntry.medicationName}.`;
      entry.conflict = this.buildConflict(persistentImpact);
    }
  }

  private applySucralfateProtocolFallback(
    entries: ConflictEntryLike[],
    anchors: Record<ClinicalAnchor, number>,
  ): void {
    const sucralfateEntries = entries.filter(
      (entry) =>
        entry.groupCode === 'GROUP_II_SUCRA' &&
        entry.status === ScheduleStatus.ACTIVE &&
        entry.timeContext.anchor !== ClinicalAnchor.DORMIR,
    );

    sucralfateEntries.forEach((entry) => {
      const primaryConflict = entries.find(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === entry.timeInMinutes,
      );
      if (!primaryConflict) return;

      const alternative = anchors[ClinicalAnchor.ALMOCO] + 120;
      const alternativeConflict = entries.find(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === alternative,
      );

      if (!alternativeConflict) {
        entry.timeInMinutes = alternative;
        entry.note =
          'Sucralfato deslocado para almoço + 2h por conflito no horário principal.';
        entry.conflict = {
          interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
          resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
          triggerMedicationName: primaryConflict.medicationName,
          triggerGroupCode: primaryConflict.groupCode,
          triggerProtocolCode: primaryConflict.protocolCode,
          rulePriority: entry.conflict?.rulePriority ?? 0,
          windowBeforeMinutes: 0,
          windowAfterMinutes: 0,
        };
        return;
      }

      entry.status = ScheduleStatus.INACTIVE;
      entry.note =
        'Sucralfato inativado por conflito no horário principal e no alternativo.';
      entry.conflict = {
        interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
        resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
        triggerMedicationName: alternativeConflict.medicationName,
        triggerGroupCode: alternativeConflict.groupCode,
        triggerProtocolCode: alternativeConflict.protocolCode,
        rulePriority: entry.conflict?.rulePriority ?? 0,
        windowBeforeMinutes: 0,
        windowAfterMinutes: 0,
      };
    });
  }

  private matchesRule(
    targetEntry: ConflictEntryLike,
    sourceEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): boolean {
    if (
      rule.targetGroupCode !== undefined &&
      rule.targetGroupCode !== sourceEntry.groupCode
    ) {
      return false;
    }

    if (
      rule.targetProtocolCode !== undefined &&
      rule.targetProtocolCode !== sourceEntry.protocolCode
    ) {
      return false;
    }

    if (
      rule.applicableSemanticTags?.length &&
      !rule.applicableSemanticTags.includes(targetEntry.semanticTag)
    ) {
      return false;
    }

    const interactionType = rule.interactionType;
    if (
      interactionType === ClinicalInteractionType.AFFECTED_BY_SALTS &&
      sourceEntry.groupCode !== 'GROUP_III_SAL'
    ) {
      return false;
    }

    if (
      interactionType === ClinicalInteractionType.AFFECTED_BY_CALCIUM &&
      sourceEntry.groupCode !== 'GROUP_III_CALC'
    ) {
      return false;
    }

    if (
      interactionType === ClinicalInteractionType.AFFECTED_BY_SUCRALFATE &&
      sourceEntry.groupCode !== 'GROUP_II_SUCRA'
    ) {
      return false;
    }

    return this.timesConflict(targetEntry, sourceEntry, rule);
  }

  private timesConflict(
    targetEntry: ConflictEntryLike,
    sourceEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): boolean {
    if (sourceEntry.timeInMinutes === targetEntry.timeInMinutes) {
      return true;
    }

    const [windowBefore, windowAfter] = this.resolveConflictWindows(
      targetEntry,
      rule,
    );

    if (windowBefore === 0 && windowAfter === 0) {
      return false;
    }

    const delta = sourceEntry.timeInMinutes - targetEntry.timeInMinutes;
    if (delta >= 0) {
      return delta <= windowAfter;
    }
    return Math.abs(delta) <= windowBefore;
  }

  private matchesRuleAtResolvedSlot(
    targetEntry: ConflictEntryLike,
    sourceEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): boolean {
    return this.matchesRule(targetEntry, sourceEntry, rule)
      && targetEntry.timeInMinutes === sourceEntry.timeInMinutes;
  }

  private resolveConflictWindows(
    targetEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): [number, number] {
    const defaultSucralfateWindow =
      rule.interactionType === ClinicalInteractionType.AFFECTED_BY_SUCRALFATE &&
      targetEntry.semanticTag === ClinicalSemanticTag.BEDTIME_EQUIVALENT
        ? 20
        : 0;

    const sharedWindow = rule.windowMinutes ?? defaultSucralfateWindow;
    const windowBefore = rule.windowBeforeMinutes ?? sharedWindow ?? 0;
    const windowAfter = rule.windowAfterMinutes ?? sharedWindow ?? 0;
    return [windowBefore, windowAfter];
  }

  private resolveShiftWindow(rule: ClinicalInteractionRuleSnapshot): number {
    return (
      rule.windowAfterMinutes ??
      rule.windowMinutes ??
      rule.windowBeforeMinutes ??
      60
    );
  }

  private buildConflict(impact: RuleImpact): ScheduleConflictDto {
    const [windowBefore, windowAfter] = this.resolveConflictWindows(
      impact.targetEntry,
      impact.rule,
    );

    return {
      interactionType: impact.rule.interactionType,
      resolutionType: impact.rule.resolutionType,
      triggerMedicationName: impact.targetEntry.medicationName,
      triggerGroupCode: impact.targetEntry.groupCode,
      triggerProtocolCode: impact.targetEntry.protocolCode,
      rulePriority: impact.rule.priority,
      windowBeforeMinutes: windowBefore,
      windowAfterMinutes: windowAfter,
    };
  }

  private isSupportedResolution(rule: ClinicalInteractionRuleSnapshot): boolean {
    return [
      ClinicalResolutionType.INACTIVATE_SOURCE,
      ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
      ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
    ].includes(rule.resolutionType);
  }
}
