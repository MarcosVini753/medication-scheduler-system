import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MedicationGroup } from './medication-group.entity';

@Entity('medication_catalog')
export class MedicationCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  commercialName?: string;

  @Column()
  activePrinciple: string;

  @Column()
  presentation: string;

  @Column()
  administrationRoute: string;

  @Column({ type: 'text' })
  usageInstructions: string;

  @Column({ default: false })
  interferesWithSalts: boolean;

  @ManyToOne(() => MedicationGroup, (group) => group.medications, { eager: true })
  group: MedicationGroup;
}
