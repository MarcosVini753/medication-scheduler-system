import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Patient } from '../modules/patients/entities/patient.entity';
import { PatientRoutine } from '../modules/patients/entities/patient-routine.entity';
import { MedicationCatalog } from '../modules/medications/entities/medication-catalog.entity';
import { MedicationGroup } from '../modules/medications/entities/medication-group.entity';
import { Prescription } from '../modules/prescriptions/entities/prescription.entity';
import { PrescriptionItem } from '../modules/prescriptions/entities/prescription-item.entity';
import { ScheduledDose } from '../modules/scheduling/entities/scheduled-dose.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Patient, PatientRoutine, MedicationGroup, MedicationCatalog, Prescription, PrescriptionItem, ScheduledDose],
  migrations: ['src/database/migrations/*.ts']
});
