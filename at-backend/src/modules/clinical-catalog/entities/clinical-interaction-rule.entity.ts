import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalProtocol } from './clinical-protocol.entity';

@Entity('clinical_interaction_rules')
export class ClinicalInteractionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalProtocol, (protocol) => protocol.interactionRules, {
    onDelete: 'CASCADE',
  })
  protocol: ClinicalProtocol;

  @Column({ type: 'varchar', length: 40 })
  interactionType: ClinicalInteractionType;

  @Column({ nullable: true })
  targetGroupCode?: string;

  @Column({ nullable: true })
  targetProtocolCode?: string;

  @Column({ type: 'varchar', length: 50 })
  resolutionType: ClinicalResolutionType;

  @Column({ type: 'int', nullable: true })
  windowMinutes?: number;

  @Column({ type: 'int', default: 0 })
  priority: number;
}
