import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { PrescriptionItem } from './prescription-item.entity';

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (patient) => patient.prescriptions, { eager: true, onDelete: 'CASCADE' })
  patient: Patient;

  @Column({ type: 'date' })
  startedAt: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, { cascade: true, eager: true })
  items: PrescriptionItem[];
}
