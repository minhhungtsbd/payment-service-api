import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { GateType } from '../gateways/gate.interface';

@Entity('payments')
@Index('idx_payments_date', ['date'])
@Index('idx_payments_transaction_id', ['transaction_id'], { unique: true })
export class PaymentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  transaction_id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'datetime' })
  date: Date;

  @Column({ type: 'enum', enum: GateType })
  gate: GateType;

  @Column({ type: 'varchar', length: 50 })
  account_receiver: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
} 