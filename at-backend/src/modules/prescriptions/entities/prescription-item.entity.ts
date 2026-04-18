import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { Prescription } from './prescription.entity';
import { MedicationCatalog } from '../../medications/entities/medication-catalog.entity';
import { ScheduledDose } from '../../scheduling/entities/scheduled-dose.entity';

export interface PrescriptionItemDoseOverride {
  doseLabel: string;
  doseValue: string;
  doseUnit: DoseUnit;
}

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

  @Column({ type: 'varchar', length: 30, default: TreatmentRecurrence.DAILY })
  recurrenceType: TreatmentRecurrence;

  @Column({ type: 'varchar', length: 50, nullable: true })
  doseValue?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  doseUnit?: DoseUnit;

  @Column({ default: true })
  sameDosePerSchedule: boolean;

  @Column({ type: 'simple-json', nullable: true })
  perDoseOverrides?: PrescriptionItemDoseOverride[];

  @Column({ default: true })
  dailyTreatment: boolean;

  @Column({ type: 'int', nullable: true })
  alternateDaysInterval?: number;

  @Column({ nullable: true })
  weeklyDay?: string;

  @Column({ nullable: true })
  monthlyRule?: string;

  @Column({ type: 'int', nullable: true })
  monthlyDay?: number;

  @Column({ type: 'int', nullable: true })
  treatmentDays?: number;

  @Column({ default: false })
  continuousUse: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  prnReason?: PrnReason;

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
