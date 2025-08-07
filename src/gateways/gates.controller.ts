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
      console.log('Testing VCB connection for gateway:', gate.getName());
      const result = await gate.getHistory();
      console.log('VCB Test result count:', result.length);
      
      if (result.length > 0) {
        console.log('Sample transaction:', JSON.stringify(result[0], null, 2));
      }
      
      return {
        success: true,
        gatewayName: gate.getName(),
        transactionCount: result.length,
        transactions: result.slice(0, 5), // Show first 5 transactions
        sampleTransaction: result.length > 0 ? result[0] : null
      };
    } catch (error) {
      console.error('VCB Test error:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack?.substring(0, 500),
        details: 'Check logs for more information'
      };
    }
  }
}
