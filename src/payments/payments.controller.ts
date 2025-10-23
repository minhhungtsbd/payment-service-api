import { Controller, Get, Query } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Payment } from '../gateways/gate.interface';
import { PAYMENT_HISTORY_UPDATED } from '../events';
import { PaymentService } from './payments.services';
import { GatesManagerService } from '../gateways/gates-manager.services';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly gatesManagerService: GatesManagerService,
  ) {}

  @OnEvent(PAYMENT_HISTORY_UPDATED)
  handlePaymentHistoryUpdateEvent(payments: Payment[]) {
    this.paymentService.addPayments(payments);
  }

  @Get()
  getPayments(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    
    return this.paymentService.getPayments(limitNum, pageNum);
  }

  @Get('real')
  async getPaymentsReal() {
    // Lấy real-time từ tất cả bank
    const results = await Promise.all(
      this.gatesManagerService['gates'].map(async (gate) => {
        try {
          const payments = await gate.getHistory();
          return payments;
        } catch (e) {
          return [];
        }
      })
    );
    // Gộp tất cả giao dịch lại thành 1 mảng
    return results.flat();
  }

  @Get('cleanup')
  async manualCleanup() {
    const result = await this.paymentService.performAutomaticCleanup();
    return {
      success: true,
      message: 'Cleanup completed',
      deletedByCount: result.deletedByCount,
      deletedByAge: result.deletedByAge,
      totalDeleted: result.deletedByCount + result.deletedByAge
    };
  }

  @Get('stats')
  async getStats() {
    const totalCount = await this.paymentService.getTotalCount();
    const oldestRecord = await this.paymentService.getOldestRecord();
    return {
      totalTransactions: totalCount,
      oldestTransaction: oldestRecord?.date || null,
      limits: {
        maxTransactions: 500,
        maxAge: '90 days'
      }
    };
  }

  @Get('format_web2m')
  async getPaymentsFormatted(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    
    return this.paymentService.getPaymentsFormatted(limitNum, pageNum);
  }
}
