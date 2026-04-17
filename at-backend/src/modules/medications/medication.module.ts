import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationCatalog } from './entities/medication-catalog.entity';
import { MedicationGroup } from './entities/medication-group.entity';
import { MedicationController } from './medication.controller';
import { MedicationService } from './medication.service';

@Module({
  imports: [TypeOrmModule.forFeature([MedicationCatalog, MedicationGroup])],
  controllers: [MedicationController],
  providers: [MedicationService],
  exports: [MedicationService, TypeOrmModule]
})
export class MedicationModule {}
