import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentService } from './payments.services';
import { PaymentEntity } from './payment.entity';
import { GatesModule } from '../gateways/gates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    GatesModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentService],
})
export class PaymentsModule {}
