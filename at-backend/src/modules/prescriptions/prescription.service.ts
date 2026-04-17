import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicationService } from '../medications/medication.service';
import { PatientService } from '../patients/patient.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';

@Injectable()
export class PrescriptionService {
  constructor(
    @InjectRepository(Prescription) private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem) private readonly itemRepository: Repository<PrescriptionItem>,
    private readonly patientService: PatientService,
    private readonly medicationService: MedicationService,
    private readonly schedulingService: SchedulingService
  ) {}

  async create(dto: CreatePrescriptionDto) {
    const patient = await this.patientService.findById(dto.patientId);

    const items = await Promise.all(
      dto.items.map(async (itemDto) => {
        const medication = await this.medicationService.findCatalogById(itemDto.medicationId);
        return this.itemRepository.create({ ...itemDto, medication });
      })
    );

    const prescription = await this.prescriptionRepository.save(
      this.prescriptionRepository.create({
        patient,
        startedAt: dto.startedAt,
        status: 'ACTIVE',
        items
      })
    );

    const loaded = await this.findById(prescription.id);
    return this.schedulingService.buildAndPersistSchedule(loaded);
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
}
