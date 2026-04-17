import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Prescription } from './prescription.entity';
import { MedicationCatalog } from '../../medications/entities/medication-catalog.entity';
import { ScheduledDose } from '../../scheduling/entities/scheduled-dose.entity';

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, (prescription) => prescription.items, { onDelete: 'CASCADE' })
  prescription: Prescription;

  @ManyToOne(() => MedicationCatalog, { eager: true })
  medication: MedicationCatalog;

  @Column({ type: 'int' })
  frequency: number;

  @Column({ type: 'varchar', length: 50, default: '1 unidade' })
  doseAmount: string;

  @Column({ default: true })
  sameDosePerSchedule: boolean;

  @Column({ default: true })
  dailyTreatment: boolean;

  @Column({ nullable: true })
  weeklyDay?: string;

  @Column({ nullable: true })
  monthlyRule?: string;

  @Column({ nullable: true })
  treatmentDays?: number;

  @Column({ default: false })
  continuousUse: boolean;

  @Column({ default: false })
  crisisOnly: boolean;

  @Column({ default: false })
  feverOnly: boolean;

  @Column({ default: false })
  painOnly: boolean;

  @Column({ default: false })
  manualAdjustmentEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true })
  manualTimes?: string[];

  @OneToMany(() => ScheduledDose, (schedule) => schedule.prescriptionItem)
  schedules: ScheduledDose[];
}
