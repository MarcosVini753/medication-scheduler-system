import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClinicalCatalogService } from '../clinical-catalog/clinical-catalog.service';
import { PatientService } from '../patients/patient.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CreatePatientPrescriptionDto } from './dto/create-patient-prescription.dto';
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
} from './entities/patient-prescription-snapshot.types';
import { PatientPrescriptionMedication } from './entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from './entities/patient-prescription-phase.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';

@Injectable()
export class PatientPrescriptionService {
  constructor(
    @InjectRepository(PatientPrescription)
    private readonly prescriptionRepository: Repository<PatientPrescription>,
    private readonly dataSource: DataSource,
    private readonly patientService: PatientService,
    private readonly clinicalCatalogService: ClinicalCatalogService,
    private readonly schedulingService: SchedulingService,
  ) {}

  async create(dto: CreatePatientPrescriptionDto) {
    const patient = await this.patientService.findById(dto.patientId);

    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepository = manager.getRepository(PatientPrescription);
      const prescriptionMedicationRepository = manager.getRepository(
        PatientPrescriptionMedication,
      );
      const phaseRepository = manager.getRepository(PatientPrescriptionPhase);

      const medications = await Promise.all(
        dto.medications.map(async (medicationDto) => {
          const clinicalMedication = await this.clinicalCatalogService.findMedicationById(
            medicationDto.clinicalMedicationId,
          );
          const protocol = clinicalMedication.protocols.find(
            (item) => item.id === medicationDto.protocolId,
          );
          if (!protocol) {
            throw new NotFoundException(
              'Protocolo clínico não encontrado para o medicamento informado.',
            );
          }

          this.ensureProtocolSupportsPhases(protocolSnapshotFromEntity(protocol), medicationDto.phases);

          const medication = prescriptionMedicationRepository.create({
            sourceClinicalMedicationId: clinicalMedication.id,
            sourceProtocolId: protocol.id,
            medicationSnapshot: medicationSnapshotFromEntity(clinicalMedication),
            protocolSnapshot: protocolSnapshotFromEntity(protocol),
            interactionRulesSnapshot: interactionRulesSnapshotFromEntity(protocol),
            phases: medicationDto.phases.map((phaseDto) =>
              phaseRepository.create({
                ...phaseDto,
                doseAmount: phaseDto.doseAmount ?? phaseDto.doseValue ?? '1 unidade',
              }),
            ),
          });

          return medication;
        }),
      );

      const prescription = await prescriptionRepository.save(
        prescriptionRepository.create({
          patient,
          startedAt: dto.startedAt,
          status: 'ACTIVE',
          medications,
        }),
      );

      const loaded = await prescriptionRepository.findOne({
        where: { id: prescription.id },
        relations: [
          'patient',
          'medications',
          'medications.phases',
        ],
      });

      if (!loaded) {
        throw new NotFoundException('Prescrição do paciente não encontrada.');
      }

      return this.schedulingService.buildAndPersistSchedule(loaded, manager);
    });
  }

  async list(): Promise<PatientPrescription[]> {
    return this.prescriptionRepository.find({
      relations: ['patient', 'medications', 'medications.phases'],
    });
  }

  async findById(id: string): Promise<PatientPrescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    return prescription;
  }

  private ensureProtocolSupportsPhases(
    protocolSnapshot: ClinicalProtocolSnapshot,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    phases.forEach((phase) => {
      const supported = protocolSnapshot.frequencies.some(
        (item) => item.frequency === phase.frequency,
      );
      if (!supported) {
        throw new NotFoundException(
          `Protocolo ${protocolSnapshot.code} não suporta frequência ${phase.frequency}.`,
        );
      }
    });
  }
}

function medicationSnapshotFromEntity(
  medication: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>,
): ClinicalMedicationSnapshot {
  return {
    id: medication.id,
    commercialName: medication.commercialName,
    activePrinciple: medication.activePrinciple,
    presentation: medication.presentation,
    administrationRoute: medication.administrationRoute,
    usageInstructions: medication.usageInstructions,
  };
}

function protocolSnapshotFromEntity(
  protocol: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>['protocols'][number],
): ClinicalProtocolSnapshot {
  return {
    id: protocol.id,
    code: protocol.code,
    name: protocol.name,
    description: protocol.description,
    groupCode: protocol.group.code,
    priority: protocol.priority,
    isDefault: protocol.isDefault,
    frequencies: protocol.frequencies.map((frequency) => ({
      frequency: frequency.frequency,
      steps: frequency.steps.map((step) => ({
        doseLabel: step.doseLabel,
        anchor: step.anchor,
        offsetMinutes: step.offsetMinutes,
        semanticTag: step.semanticTag,
      })),
    })),
  };
}

function interactionRulesSnapshotFromEntity(
  protocol: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>['protocols'][number],
): ClinicalInteractionRuleSnapshot[] {
  return protocol.interactionRules.map((rule) => ({
    interactionType: rule.interactionType,
    targetGroupCode: rule.targetGroupCode,
    targetProtocolCode: rule.targetProtocolCode,
    resolutionType: rule.resolutionType,
    windowMinutes: rule.windowMinutes,
    priority: rule.priority,
  }));
}
