import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationModule } from '../medications/medication.module';
import { PatientModule } from '../patients/patient.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescription, PrescriptionItem]),
    PatientModule,
    MedicationModule,
    forwardRef(() => SchedulingModule)
  ],
  controllers: [PrescriptionController],
  providers: [PrescriptionService],
  exports: [PrescriptionService, TypeOrmModule]
})
export class PrescriptionModule {}
