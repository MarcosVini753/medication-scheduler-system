import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hhmmToMinutes } from '../../common/utils/time.util';
import { MealAnchor } from '../../common/enums/meal-anchor.enum';
import { validateRoutine } from '../../common/utils/routine.util';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { Patient } from './entities/patient.entity';
import { PatientRoutine } from './entities/patient-routine.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient) private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientRoutine) private readonly routineRepository: Repository<PatientRoutine>
  ) {}

  async createPatient(dto: CreatePatientDto): Promise<Patient> {
    return this.patientRepository.save(this.patientRepository.create(dto));
  }

  async addRoutine(patientId: string, dto: CreateRoutineDto): Promise<PatientRoutine> {
    const patient = await this.patientRepository.findOne({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Paciente não encontrado.');

    validateRoutine({
      [MealAnchor.ACORDAR]: hhmmToMinutes(dto.acordar),
      [MealAnchor.CAFE]: hhmmToMinutes(dto.cafe),
      [MealAnchor.ALMOCO]: hhmmToMinutes(dto.almoco),
      [MealAnchor.LANCHE]: hhmmToMinutes(dto.lanche),
      [MealAnchor.JANTAR]: hhmmToMinutes(dto.jantar),
      [MealAnchor.DORMIR]: hhmmToMinutes(dto.dormir)
    });

    await this.routineRepository.update({ patient: { id: patientId }, active: true }, { active: false });
    return this.routineRepository.save(this.routineRepository.create({ ...dto, patient, active: dto.active ?? true }));
  }

  async findById(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id }, relations: ['routines'] });
    if (!patient) throw new NotFoundException('Paciente não encontrado.');
    return patient;
  }

  async getActiveRoutine(patientId: string): Promise<PatientRoutine> {
    const routine = await this.routineRepository.findOne({ where: { patient: { id: patientId }, active: true }, relations: ['patient'] });
    if (!routine) throw new NotFoundException('Rotina ativa do paciente não encontrada.');
    return routine;
  }

  async list(): Promise<Patient[]> {
    return this.patientRepository.find({ relations: ['routines'] });
  }
}
