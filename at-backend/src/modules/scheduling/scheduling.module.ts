import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientModule } from '../patients/patient.module';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { ScheduledDose } from './entities/scheduled-dose.entity';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { SchedulingRulesService } from './services/scheduling-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduledDose, Prescription]), forwardRef(() => PatientModule)],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingRulesService],
  exports: [SchedulingService]
})
export class SchedulingModule {}
