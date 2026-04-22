import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalProtocol } from './clinical-protocol.entity';
import { ClinicalProtocolStep } from './clinical-protocol-step.entity';

@Entity('clinical_protocol_frequencies')
export class ClinicalProtocolFrequency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalProtocol, (protocol) => protocol.frequencies, {
    onDelete: 'CASCADE',
  })
  protocol: ClinicalProtocol;

  @Column({ type: 'int' })
  frequency: number;

  @OneToMany(() => ClinicalProtocolStep, (step) => step.frequencyConfig, {
    cascade: true,
    eager: true,
  })
  steps: ClinicalProtocolStep[];
}
