import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalProtocol } from './clinical-protocol.entity';

@Entity('clinical_medications')
export class ClinicalMedication {
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
  isDefault: boolean;

  @OneToMany(() => ClinicalProtocol, (protocol) => protocol.medication, {
    cascade: true,
    eager: true,
  })
  protocols: ClinicalProtocol[];
}
