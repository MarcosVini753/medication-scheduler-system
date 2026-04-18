import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PrnReason } from '../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import { MedicationService } from '../medications/medication.service';
import { PatientService } from '../patients/patient.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CreatePrescriptionDto, CreatePrescriptionItemDto } from './dto/create-prescription.dto';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';

@Injectable()
export class PrescriptionService {
  constructor(
    @InjectRepository(Prescription) private readonly prescriptionRepository: Repository<Prescription>,
    private readonly dataSource: DataSource,
    private readonly patientService: PatientService,
    private readonly medicationService: MedicationService,
    private readonly schedulingService: SchedulingService
  ) {}

  async create(dto: CreatePrescriptionDto) {
    const patient = await this.patientService.findById(dto.patientId);

    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepository = manager.getRepository(Prescription);
      const itemRepository = manager.getRepository(PrescriptionItem);

      const items = await Promise.all(
        dto.items.map(async (itemDto) => {
          const medication = await this.medicationService.findCatalogById(itemDto.medicationId);
          return itemRepository.create({
            ...this.normalizeItemDto(itemDto),
            medication
          });
        })
      );

      const prescription = await prescriptionRepository.save(
        prescriptionRepository.create({
          patient,
          startedAt: dto.startedAt,
          status: 'ACTIVE',
          items
        })
      );

      const loaded = await prescriptionRepository.findOne({
        where: { id: prescription.id },
        relations: ['patient', 'items', 'items.medication', 'items.medication.group']
      });

      if (!loaded) {
        throw new NotFoundException('Prescrição não encontrada.');
      }

      return this.schedulingService.buildAndPersistSchedule(loaded, manager);
    });
  }

  async list(): Promise<Prescription[]> {
    return this.prescriptionRepository.find({ relations: ['items', 'items.medication', 'items.medication.group', 'patient'] });
  }

  async findById(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['patient', 'items', 'items.medication', 'items.medication.group']
    });
    if (!prescription) throw new NotFoundException('Prescrição não encontrada.');
    return prescription;
  }

  private normalizeItemDto(itemDto: CreatePrescriptionItemDto): Partial<PrescriptionItem> {
    const recurrenceType = itemDto.recurrenceType ?? this.inferRecurrenceType(itemDto);
    const prnReason = itemDto.prnReason ?? this.inferPrnReason(itemDto);
    const doseValue = itemDto.doseValue ?? itemDto.doseAmount;

    return {
      ...itemDto,
      doseAmount: itemDto.doseAmount ?? doseValue ?? '1 unidade',
      doseValue,
      recurrenceType,
      prnReason,
      dailyTreatment: itemDto.dailyTreatment ?? recurrenceType === TreatmentRecurrence.DAILY,
      crisisOnly: itemDto.crisisOnly ?? prnReason === PrnReason.CRISIS,
      feverOnly: itemDto.feverOnly ?? prnReason === PrnReason.FEVER,
      painOnly: itemDto.painOnly ?? prnReason === PrnReason.PAIN
    };
  }

  private inferRecurrenceType(itemDto: CreatePrescriptionItemDto): TreatmentRecurrence {
    if (itemDto.prnReason || itemDto.crisisOnly || itemDto.feverOnly || itemDto.painOnly) {
      return TreatmentRecurrence.PRN;
    }

    if (itemDto.monthlyDay !== undefined || itemDto.monthlyRule) {
      return TreatmentRecurrence.MONTHLY;
    }

    if (itemDto.weeklyDay) {
      return TreatmentRecurrence.WEEKLY;
    }

    if (itemDto.alternateDaysInterval && itemDto.alternateDaysInterval > 1) {
      return TreatmentRecurrence.ALTERNATE_DAYS;
    }

    return TreatmentRecurrence.DAILY;
  }

  private inferPrnReason(itemDto: CreatePrescriptionItemDto): PrnReason | undefined {
    if (itemDto.crisisOnly) return PrnReason.CRISIS;
    if (itemDto.feverOnly) return PrnReason.FEVER;
    if (itemDto.painOnly) return PrnReason.PAIN;
    return undefined;
  }
}
