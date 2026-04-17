import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionService } from './prescription.service';
import { SchedulingService } from '../scheduling/scheduling.service';

@Controller('prescriptions')
export class PrescriptionController {
  constructor(
    private readonly prescriptionService: PrescriptionService,
    private readonly schedulingService: SchedulingService
  ) {}

  @Post()
  create(@Body() dto: CreatePrescriptionDto) {
    return this.prescriptionService.create(dto);
  }

  @Get()
  list() {
    return this.prescriptionService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prescriptionService.findById(id);
  }

  @Get(':id/schedule')
  getSchedule(@Param('id') id: string) {
    return this.schedulingService.getScheduleByPrescription(id);
  }
}
