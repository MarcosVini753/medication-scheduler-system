import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { MedicationService } from './medication.service';

@Controller('medications')
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

  @Post('seed-groups')
  seedGroups() {
    return this.medicationService.createDefaultGroups();
  }

  @Get('groups')
  listGroups() {
    return this.medicationService.listGroups();
  }

  @Post()
  create(@Body() dto: CreateMedicationDto) {
    return this.medicationService.createMedication(dto);
  }

  @Get()
  list() {
    return this.medicationService.listCatalog();
  }
}
