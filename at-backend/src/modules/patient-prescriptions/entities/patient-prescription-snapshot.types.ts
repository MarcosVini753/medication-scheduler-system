import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';

export interface ClinicalMedicationSnapshot {
  id: string;
  commercialName?: string;
  activePrinciple: string;
  presentation: string;
  administrationRoute: string;
  usageInstructions: string;
}

export interface ProtocolStepSnapshot {
  doseLabel: string;
  anchor: ClinicalAnchor;
  offsetMinutes: number;
  semanticTag: ClinicalSemanticTag;
}

export interface ProtocolFrequencySnapshot {
  frequency: number;
  steps: ProtocolStepSnapshot[];
}

export interface ClinicalInteractionRuleSnapshot {
  interactionType: ClinicalInteractionType;
  targetGroupCode?: string;
  targetProtocolCode?: string;
  resolutionType: ClinicalResolutionType;
  windowMinutes?: number;
  priority: number;
}

export interface ClinicalProtocolSnapshot {
  id: string;
  code: string;
  name: string;
  description: string;
  groupCode: string;
  priority: number;
  isDefault: boolean;
  frequencies: ProtocolFrequencySnapshot[];
}

export interface PrescriptionPhaseDoseOverride {
  doseLabel: string;
  doseValue: string;
  doseUnit: DoseUnit;
}
