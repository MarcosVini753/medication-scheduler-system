import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { PatientService } from './patient.service';

@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.patientService.createPatient(dto);
  }

  @Get()
  list() {
    return this.patientService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientService.findById(id);
  }

  @Post(':id/routines')
  addRoutine(@Param('id') id: string, @Body() dto: CreateRoutineDto) {
    return this.patientService.addRoutine(id, dto);
  }
}
