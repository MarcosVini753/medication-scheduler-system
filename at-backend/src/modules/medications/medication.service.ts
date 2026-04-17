import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GroupCode } from "../../common/enums/group-code.enum";
import { CreateMedicationDto } from "./dto/create-medication.dto";
import { MedicationCatalog } from "./entities/medication-catalog.entity";
import { MedicationGroup } from "./entities/medication-group.entity";

@Injectable()
export class MedicationService {
  constructor(
    @InjectRepository(MedicationCatalog)
    private readonly medicationRepository: Repository<MedicationCatalog>,
    @InjectRepository(MedicationGroup)
    private readonly groupRepository: Repository<MedicationGroup>,
  ) {}

  async createMedication(dto: CreateMedicationDto): Promise<MedicationCatalog> {
    const group = await this.groupRepository.findOne({
      where: { id: dto.groupId },
    });
    if (!group)
      throw new NotFoundException("Grupo do medicamento não encontrado.");
    return this.medicationRepository.save(
      this.medicationRepository.create({ ...dto, group }),
    );
  }

  async findCatalogById(id: string): Promise<MedicationCatalog> {
    const medication = await this.medicationRepository.findOne({
      where: { id },
    });
    if (!medication) throw new NotFoundException("Medicamento não encontrado.");
    return medication;
  }

  async listCatalog(): Promise<MedicationCatalog[]> {
    return this.medicationRepository.find();
  }

  async listGroups(): Promise<MedicationGroup[]> {
    return this.groupRepository.find({ order: { code: "ASC" } });
  }

  async createDefaultGroups(): Promise<MedicationGroup[]> {
    const defaults: Array<
      Pick<MedicationGroup, "code" | "name" | "description">
    > = [
      {
        code: GroupCode.GROUP_I,
        name: "Grupo I",
        description: "Medicamentos independentes das refeições.",
      },
      {
        code: GroupCode.GROUP_II,
        name: "Grupo II",
        description:
          "Medicamentos em jejum ou em horários específicos pré/pós-refeição.",
      },
      {
        code: GroupCode.GROUP_II_BIFOS,
        name: "Grupo II - Bifosfonatos",
        description: "Acordar 1 hora mais cedo.",
      },
      {
        code: GroupCode.GROUP_II_SUCRA,
        name: "Grupo II - Sucralfato",
        description: "Possui regra especial de deslocamento e inativação.",
      },
      {
        code: GroupCode.GROUP_III,
        name: "Grupo III",
        description: "Medicamentos junto ou associados às refeições.",
      },
      {
        code: GroupCode.GROUP_III_LAX,
        name: "Grupo III - Lax",
        description: "Laxativos após refeição e/ou dormir.",
      },
      {
        code: GroupCode.GROUP_III_SAL,
        name: "Grupo III - Sal",
        description: "Sais com regra de inativação em conflito.",
      },
      {
        code: GroupCode.GROUP_III_ESTAT,
        name: "Grupo III - Estatina",
        description: "Tomar no jantar.",
      },
      {
        code: GroupCode.GROUP_III_DIU,
        name: "Grupo III - DIU",
        description: "Tomar em café e opcionalmente lanche.",
      },
      {
        code: GroupCode.GROUP_III_MET,
        name: "Grupo III - Metformina",
        description: "Relacionada às refeições principais.",
      },
      {
        code: GroupCode.GROUP_III_SUL,
        name: "Grupo III - Sul",
        description: "Sulfonilureias com refeições.",
      },
      {
        code: GroupCode.GROUP_III_SUL2,
        name: "Grupo III - Sul 2",
        description: "30 minutos antes das refeições.",
      },
      {
        code: GroupCode.GROUP_III_PROC,
        name: "Grupo III - Proc",
        description: "20 minutos antes das refeições.",
      },
      {
        code: GroupCode.GROUP_I_SED,
        name: "Grupo I - Sed",
        description: "20 minutos antes de dormir.",
      },
      {
        code: GroupCode.GROUP_III_CALC,
        name: "Grupo III - Cálcio",
        description: "Regra fixa café + 3h e possível deslocamento.",
      },
      {
        code: GroupCode.GROUP_III_FER,
        name: "Grupo III - Ferro",
        description: "30 minutos antes do almoço.",
      },
      {
        code: GroupCode.GROUP_DELTA,
        name: "Grupo Delta",
        description: "Medicamentos não orais.",
      },
      {
        code: GroupCode.GROUP_INSUL_ULTRA,
        name: "Grupo Insulina Ultra-rápida",
        description: "10 minutos antes das refeições.",
      },
      {
        code: GroupCode.GROUP_INSUL_RAPIDA,
        name: "Grupo Insulina Rápida",
        description: "30 minutos antes das refeições.",
      },
      {
        code: GroupCode.GROUP_INSUL_INTER,
        name: "Grupo Insulina Intermediária",
        description: "Café e jantar.",
      },
      {
        code: GroupCode.GROUP_INSUL_LONGA,
        name: "Grupo Insulina Longa",
        description: "Dose fixa no café.",
      },
    ];

    const existing = await this.groupRepository.find();
    const existingCodes = new Set(existing.map((item) => item.code));
    const pending = defaults.filter((item) => !existingCodes.has(item.code));

    if (pending.length === 0) return existing;
    return this.groupRepository.save(
      pending.map((item) => this.groupRepository.create(item)),
    );
  }
}
