import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { Patient } from './entities/patient.entity';
import { PatientRoutine } from './entities/patient-routine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, PatientRoutine])],
  controllers: [PatientController],
  providers: [PatientService],
  exports: [PatientService, TypeOrmModule]
})
export class PatientModule {}
