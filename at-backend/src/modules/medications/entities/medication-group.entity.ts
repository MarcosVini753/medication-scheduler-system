import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MedicationCatalog } from './medication-catalog.entity';

@Entity('medication_groups')
export class MedicationGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @OneToMany(() => MedicationCatalog, (catalog) => catalog.group)
  medications: MedicationCatalog[];
}
