import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalInteractionType } from '../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../common/enums/clinical-semantic-tag.enum';
import { GroupCode } from '../../common/enums/group-code.enum';
import {
  CreateClinicalMedicationDto,
  CreateClinicalProtocolDto,
} from './dto/create-clinical-medication.dto';
import { ClinicalGroup } from './entities/clinical-group.entity';
import { ClinicalInteractionRule } from './entities/clinical-interaction-rule.entity';
import { ClinicalMedication } from './entities/clinical-medication.entity';
import { ClinicalProtocolFrequency } from './entities/clinical-protocol-frequency.entity';
import { ClinicalProtocol } from './entities/clinical-protocol.entity';
import { ClinicalProtocolStep } from './entities/clinical-protocol-step.entity';

@Injectable()
export class ClinicalCatalogService {
  constructor(
    @InjectRepository(ClinicalMedication)
    private readonly clinicalMedicationRepository: Repository<ClinicalMedication>,
    @InjectRepository(ClinicalGroup)
    private readonly clinicalGroupRepository: Repository<ClinicalGroup>,
  ) {}

  async createMedication(dto: CreateClinicalMedicationDto): Promise<ClinicalMedication> {
    const groups = await this.clinicalGroupRepository.find();
    const groupsByCode = new Map(groups.map((group) => [group.code, group]));

    const medication = this.clinicalMedicationRepository.create({
      commercialName: dto.commercialName,
      activePrinciple: dto.activePrinciple,
      presentation: dto.presentation,
      pharmaceuticalForm: dto.pharmaceuticalForm,
      administrationRoute: dto.administrationRoute,
      usageInstructions: dto.usageInstructions,
      diluentType: dto.diluentType,
      defaultAdministrationUnit: dto.defaultAdministrationUnit,
      supportsManualAdjustment: dto.supportsManualAdjustment ?? false,
      isOphthalmic: dto.isOphthalmic ?? false,
      isOtic: dto.isOtic ?? false,
      isContraceptiveMonthly: dto.isContraceptiveMonthly ?? false,
      requiresGlycemiaScale: dto.requiresGlycemiaScale ?? false,
      notes: dto.notes,
      isDefault: dto.isDefault ?? false,
      protocols: dto.protocols.map((protocolDto) =>
        this.buildProtocol(protocolDto, groupsByCode),
      ),
    });

    return this.clinicalMedicationRepository.save(medication);
  }

  async listMedications(): Promise<ClinicalMedication[]> {
    return this.clinicalMedicationRepository.find();
  }

  async listGroups(): Promise<ClinicalGroup[]> {
    return this.clinicalGroupRepository.find({ order: { code: 'ASC' } });
  }

  async findMedicationById(id: string): Promise<ClinicalMedication> {
    const medication = await this.clinicalMedicationRepository.findOne({
      where: { id },
    });
    if (!medication) {
      throw new NotFoundException('Medicamento clínico não encontrado.');
    }
    return medication;
  }

  async findProtocolById(protocolId: string): Promise<ClinicalProtocol> {
    const medication = await this.clinicalMedicationRepository.find();
    for (const currentMedication of medication) {
      const protocol = currentMedication.protocols.find((item) => item.id === protocolId);
      if (protocol) return protocol;
    }
    throw new NotFoundException('Protocolo clínico não encontrado.');
  }

  async seedCatalog(): Promise<ClinicalGroup[]> {
    const defaults = [
      {
        code: GroupCode.GROUP_I,
        name: 'Grupo I',
        description: 'Medicamentos independentes das refeições.',
      },
      {
        code: GroupCode.GROUP_II,
        name: 'Grupo II',
        description: 'Medicamentos em jejum ou em horários específicos pré-refeição.',
      },
      {
        code: GroupCode.GROUP_II_BIFOS,
        name: 'Grupo II - Bifosfonatos',
        description: 'Acordar 1 hora mais cedo.',
      },
      {
        code: GroupCode.GROUP_II_SUCRA,
        name: 'Grupo II - Sucralfato',
        description: 'Regra especial de deslocamento e inativação.',
      },
      {
        code: GroupCode.GROUP_III,
        name: 'Grupo III',
        description: 'Medicamentos relacionados às refeições.',
      },
      {
        code: GroupCode.GROUP_III_MET,
        name: 'Grupo III - Met',
        description: 'Medicamento junto às refeições principais.',
      },
      {
        code: GroupCode.GROUP_III_SAL,
        name: 'Grupo III - Sal',
        description: 'Sais com inativação por conflito.',
      },
      {
        code: GroupCode.GROUP_III_CALC,
        name: 'Grupo III - Calc',
        description: 'Cálcio com possível deslocamento de 1 hora.',
      },
      {
        code: GroupCode.GROUP_I_SED,
        name: 'Grupo I - Sed',
        description: '20 minutos antes de dormir.',
      },
      {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
        description: 'Protocolos não orais.',
      },
    ];

    const existing = await this.clinicalGroupRepository.find();
    const existingCodes = new Set(existing.map((group) => group.code));
    const missing = defaults.filter((group) => !existingCodes.has(group.code));
    if (missing.length > 0) {
      await this.clinicalGroupRepository.save(
        missing.map((group) => this.clinicalGroupRepository.create(group)),
      );
    }
    return this.listGroups();
  }

  private buildProtocol(
    dto: CreateClinicalProtocolDto,
    groupsByCode: Map<string, ClinicalGroup>,
  ): ClinicalProtocol {
    const group = groupsByCode.get(dto.groupCode);
    if (!group) {
      throw new NotFoundException(`Grupo clínico ${dto.groupCode} não encontrado.`);
    }

    const protocol = new ClinicalProtocol();
    protocol.code = dto.code;
    protocol.name = dto.name;
    protocol.description = dto.description;
    protocol.subgroupCode = dto.subgroupCode;
    protocol.priority = dto.priority ?? 0;
    protocol.isDefault = dto.isDefault ?? false;
    protocol.active = dto.active ?? true;
    protocol.clinicalNotes = dto.clinicalNotes;
    protocol.group = group;
    protocol.frequencies = dto.frequencies.map((frequencyDto) => {
      const frequency = new ClinicalProtocolFrequency();
      frequency.frequency = frequencyDto.frequency;
      frequency.label = frequencyDto.label;
      frequency.allowedRecurrenceTypes = frequencyDto.allowedRecurrenceTypes;
      frequency.allowsPrn = frequencyDto.allowsPrn ?? false;
      frequency.allowsVariableDoseBySchedule =
        frequencyDto.allowsVariableDoseBySchedule ?? false;
      frequency.steps = frequencyDto.steps.map((stepDto) => {
        const step = new ClinicalProtocolStep();
        step.doseLabel = stepDto.doseLabel;
        step.anchor = stepDto.anchor;
        step.offsetMinutes = stepDto.offsetMinutes;
        step.semanticTag = stepDto.semanticTag ?? ClinicalSemanticTag.STANDARD;
        return step;
      });
      return frequency;
    });
    protocol.interactionRules = (dto.interactionRules ?? []).map((ruleDto) => {
      const rule = new ClinicalInteractionRule();
      rule.interactionType =
        ruleDto.interactionType ?? ClinicalInteractionType.AFFECTED_BY_SALTS;
      rule.targetGroupCode = ruleDto.targetGroupCode;
      rule.targetProtocolCode = ruleDto.targetProtocolCode;
      rule.resolutionType =
        ruleDto.resolutionType ?? ClinicalResolutionType.INACTIVATE_SOURCE;
      rule.windowMinutes = ruleDto.windowMinutes;
      rule.windowBeforeMinutes = ruleDto.windowBeforeMinutes ?? ruleDto.windowMinutes;
      rule.windowAfterMinutes = ruleDto.windowAfterMinutes ?? ruleDto.windowMinutes;
      rule.applicableSemanticTags = ruleDto.applicableSemanticTags;
      rule.priority = ruleDto.priority ?? 0;
      return rule;
    });
    return protocol;
  }
}
