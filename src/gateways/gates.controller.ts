import { Controller, Get, Query } from '@nestjs/common';
import { GatesManagerService } from './gates-manager.services';
import * as moment from 'moment-timezone';
import { OnEvent } from '@nestjs/event-emitter';
import { GATEWAY_START_CRON, GATEWAY_STOP_CRON } from '../events';

@Controller('gateways')
export class GatesController {
  constructor(private readonly gateManagerService: GatesManagerService) {}

  @Get('stop-gate')
  stopGate(
    @Query('name') name: string,
    @Query('time_in_sec') timeInSec: number,
  ) {
    this.gateManagerService.stopCron(name, timeInSec);
    return {
      message: 'ok',
      next_run: moment()
        .add(timeInSec, 'seconds')
        .tz('Asia/Ho_Chi_Minh')
        .format('DD-MM-YYYY HH:mm:ss'),
    };
  }

  @OnEvent(GATEWAY_STOP_CRON)
  stopGateCron() {
    this.gateManagerService.stopAllCron();
  }

  @OnEvent(GATEWAY_START_CRON)
  startGateCron() {
    this.gateManagerService.startAllCron();
  }

  @Get('vcb-status')
  getVCBStatus() {
    const vcbGates = this.gateManagerService['gates'].filter(gate => 
      gate.getName().toLowerCase().includes('vcb')
    );
    
    return {
      message: 'VCB Gateway Status',
      gateways: vcbGates.map(gate => ({
        name: gate.getName(),
        type: gate['config']?.type,
        account: gate['config']?.account,
        hasSession: !!gate['sessionId'],
        lastError: gate['lastError'] || 'None',
        error108Count: gate['error108Count'] || 0
      }))
    };
  }

  @Get('vcb-test')
  async testVCBConnection() {
    try {
      const vcbGates = this.gateManagerService['gates'].filter(gate => 
        gate.getName().toLowerCase().includes('vcb')
      );
      
      if (vcbGates.length === 0) {
        return { error: 'No VCB gateways configured' };
      }
      
      const gate = vcbGates[0];
      const result = await gate.getHistory();
      
      return {
        success: true,
        gatewayName: gate.getName(),
        transactionCount: result.length,
        transactions: result.slice(0, 3) // Show first 3 transactions only
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: 'Check logs for more information'
      };
    }
  }
}
