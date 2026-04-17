import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';

@Entity('scheduled_doses')
export class ScheduledDose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, { onDelete: 'CASCADE' })
  prescription: Prescription;

  @ManyToOne(() => PrescriptionItem, (item) => item.schedules, { eager: true, onDelete: 'CASCADE' })
  prescriptionItem: PrescriptionItem;

  @Column()
  doseLabel: string;

  @Column({ type: 'int' })
  timeInMinutes: number;

  @Column({ type: 'time' })
  timeFormatted: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
