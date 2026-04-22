import { Controller, Get, Param } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';

@Controller('schedules')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('patient-prescription/:id')
  findByPrescription(@Param('id') id: string) {
    return this.schedulingService.getScheduleByPrescription(id);
  }
}
