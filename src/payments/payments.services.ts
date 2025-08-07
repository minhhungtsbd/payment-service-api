import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Payment, GateType } from '../gateways/gate.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_CREATED } from '../events';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from './payment.entity';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment-timezone';

@Injectable()
export class PaymentService implements OnApplicationBootstrap {
  constructor(
    private eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
  ) {}

  async onApplicationBootstrap() {
    // Không cần load từ Redis nữa
  }

  isExists(payment: Payment) {
    return this.paymentRepository.findOne({
      where: { transaction_id: payment.transaction_id }
    }).then(exists => !!exists);
  }

  /**
   * Vì một số bank không trả về thời gian, nên nếu thời gian trả về là 00:00:00 của ngày hiện tại thì sẽ thay thế bằng giờ hiện tại
   * @param date Date
   * @returns Date
   */
  replaceDateTodayAndNoTime = (date: Date): Date => {
    const dateMoment = moment.tz(date, 'Asia/Ho_Chi_Minh');
    const dateNow = moment().tz('Asia/Ho_Chi_Minh');
    const dateNoTime =
      dateMoment.get('hour') == 0 &&
      dateMoment.get('minute') == 0 &&
      dateMoment.get('second') == 0;

    if (dateMoment.isSame(dateNow, 'day') && dateNoTime) {
      return new Date();
    }
    return date;
  };

  async addPayments(payments: Payment[]) {
    const newPayments = [];
    
    for (const payment of payments) {
      // Kiểm tra xem giao dịch đã tồn tại chưa
      const exists = await this.paymentRepository.findOne({
        where: { transaction_id: payment.transaction_id }
      });
      
      if (!exists) {
        newPayments.push(payment);
      }
    }

    if (newPayments.length === 0) return;

    const replaceDateTimeNewPayments = newPayments.map((payment) => ({
      ...payment,
      date: this.replaceDateTodayAndNoTime(payment.date),
    }));

    this.eventEmitter.emit(PAYMENT_CREATED, replaceDateTimeNewPayments);

    // Lưu vào database
    await this.paymentRepository.save(replaceDateTimeNewPayments);
    
    // Perform automatic cleanup after adding new payments
    try {
      const cleanup = await this.performAutomaticCleanup();
      if (cleanup.deletedByCount > 0 || cleanup.deletedByAge > 0) {
        console.log(`Cleanup completed: ${cleanup.deletedByCount} by count limit, ${cleanup.deletedByAge} by age limit`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Automatic cleanup: Keep max 500 transactions OR 3 months, whichever limit is reached first
   */
  async performAutomaticCleanup(): Promise<{ deletedByCount: number; deletedByAge: number }> {
    const maxTransactions = 500;
    const retentionDays = 90; // 3 months
    
    // Count total transactions
    const totalCount = await this.paymentRepository.count();
    
    let deletedByCount = 0;
    let deletedByAge = 0;
    
    // Cleanup by count limit (keep only latest 500)
    if (totalCount > maxTransactions) {
      const excessCount = totalCount - maxTransactions;
      const oldestTransactions = await this.paymentRepository
        .createQueryBuilder('payment')
        .orderBy('payment.date', 'ASC')
        .limit(excessCount)
        .getMany();
        
      if (oldestTransactions.length > 0) {
        const idsToDelete = oldestTransactions.map(t => t.id);
        const result = await this.paymentRepository
          .createQueryBuilder()
          .delete()
          .whereInIds(idsToDelete)
          .execute();
        deletedByCount = result.affected || 0;
      }
    }
    
    // Cleanup by age (remove anything older than 3 months)
    const cutoffDate = moment().subtract(retentionDays, 'days').toDate();
    const ageResult = await this.paymentRepository
      .createQueryBuilder()
      .delete()
      .where('date < :cutoffDate', { cutoffDate })
      .execute();
    deletedByAge = ageResult.affected || 0;
    
    return { deletedByCount, deletedByAge };
  }

  async getTotalCount(): Promise<number> {
    return await this.paymentRepository.count();
  }

  async getOldestRecord(): Promise<PaymentEntity | null> {
    return await this.paymentRepository
      .createQueryBuilder('payment')
      .orderBy('payment.date', 'ASC')
      .getOne();
  }

  async getPayments(limit?: number, page: number = 1): Promise<Payment[]> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .orderBy('payment.date', 'DESC');

    if (limit) {
      const offset = (page - 1) * limit;
      queryBuilder.limit(limit).offset(offset);
    }

    const payments = await queryBuilder.getMany();
    
    return payments.map(payment => ({
      transaction_id: payment.transaction_id,
      content: payment.content,
      amount: Number(payment.amount),
      date: payment.date,
      gate: payment.gate as GateType,
      account_receiver: payment.account_receiver,
    }));
  }
}
