import * as https from 'https';
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as moment from 'moment-timezone';

import { GateType, Payment } from '../../gate.interface';
import { Gate } from '../../gates.services';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { sleep } from '../../../shards/helpers/sleep';
import { VCBLoginDto, TransactionDto } from './vcb.bank.type';
import { Encrypt } from './encrypt';
import { axios } from '../../../shards/helpers/axios';

@Injectable()
export class VCBBankService extends Gate {
  private encrypt = new Encrypt();
  private sessionId: string | null = null;
  private cif: string | null = null;
  private mobileId: string | null = null;
  private clientId: string | null = null;
  private lastLoginTime: number = 0;
  private error108Count: number = 0;
  private lastError: string | null = null;
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private readonly browserVersion = 'Chrome 120.0.0.0';

  /**
   * Generate a new device ID to help avoid VCB error 108
   * Call this method if you're getting persistent multiple device access errors
   */
  generateNewDeviceId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    const deviceId = crypto.createHash('md5').update(timestamp + random + this.config.login_id).digest('hex');
    console.log('Generated new VCB device ID:', deviceId);
    console.log('Update your config.yml with: device_id:', deviceId);
    return deviceId;
  }

  getAgent() {
    if (this.proxy != null) {
      if (this.proxy.username && this.proxy.username.length > 0) {
        return new HttpsProxyAgent(
          `${this.proxy.schema}://${this.proxy.username}:${this.proxy.password}@${this.proxy.ip}:${this.proxy.port}`,
        );
      }
      return new HttpsProxyAgent(
        `${this.proxy.schema}://${this.proxy.ip}:${this.proxy.port}`,
      );
    }
    return new https.Agent({
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    });
  }

  private async makeRequest<T>(path: string, body: any): Promise<T> {
    try {
      const { data } = await axios.post(
        'https://digiapp.vietcombank.com.vn' + path,
        this.encrypt.encryptRequest(body),
        {
          headers: {
            'X-Request-ID':
              String(new Date().getTime()) +
              String(parseInt((100 * Math.random()).toString())),
            'X-Channel': 'Web',
            'X-Lim-ID': this.encrypt.sha256(this.config.login_id + '1236q93-@u9'),
            'User-Agent': this.userAgent,
            Accept: 'application/json',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            Referer: 'https://vcbdigibank.vietcombank.com.vn/',
            Origin: 'https://vcbdigibank.vietcombank.com.vn',
          },
          httpsAgent: this.getAgent(),
        },
      );
      
      if (!data) {
        throw new Error('Empty response from VCB API');
      }
      
      const decryptedResponse = this.encrypt.decryptResponse(data);
      if (!decryptedResponse) {
        throw new Error('Failed to decrypt VCB response');
      }
      
      return JSON.parse(decryptedResponse) as T;
    } catch (error) {
      if (error.message?.includes('Encrypted message length is invalid')) {
        console.warn('VCB encryption error - session may be expired');
        this.sessionId = null; // Force re-login on next attempt
      }
      throw error;
    }
  }
  private async login() {
    // get captcha image and convert to base64
    const captchaToken = uuidv4();
    const captcha = await axios.get(
      'https://digiapp.vietcombank.com.vn/utility-service/v2/captcha/MASS/' +
        captchaToken,
      {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          Referer: 'https://vcbdigibank.vietcombank.com.vn/',
        },
      },
    );
    const captchaBase64 = Buffer.from(captcha.data, 'binary').toString(
      'base64',
    );
    const captchaValue = await this.captchaSolver.solveCaptcha(captchaBase64);
    if (captchaValue.length !== 5) {
      throw new Error('Captcha value is invalid');
    }

    const loginRes = await this.makeRequest<VCBLoginDto>(
      '/authen-service/v1/login',
      {
        captchaToken,
        captchaValue,
        password: this.config.password,
        user: this.config.login_id,
        browserId: this.config.device_id,
        mid: 6,
        lang: 'vi',
        E: null,
        sessionId: null,
        DT: 'Windows',
        PM: this.browserVersion,
        OV: '10',
        appVersion: '',
      },
    );
    if (loginRes.code == '00' && loginRes.sessionId && loginRes.userInfo) {
      this.sessionId = loginRes.sessionId;
      this.cif = loginRes.userInfo?.cif;
      this.mobileId = loginRes.userInfo?.mobileId;
      this.clientId = loginRes.userInfo?.clientId;
      this.lastLoginTime = Date.now();
      this.error108Count = 0; // Reset error count on successful login
      this.lastError = null; // Clear last error on successful login
      console.log(`VCB Login successful for account: ${this.config.account}`);
      console.log(`Session ID: ${this.sessionId?.substring(0, 8)}...`);
      console.log(`CIF: ${this.cif}, Mobile ID: ${this.mobileId}`);
      console.log(`Device ID: ${this.config.device_id?.substring(0, 8)}...`);
    } else {
      const errorMsg = `VCB Login failed: ${loginRes.code} - ${loginRes.des || 'Unknown error'}`;
      this.lastError = errorMsg;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async getHistory(): Promise<Payment[]> {
    if (!this.sessionId) await this.login();

    try {
      const fromDate = moment()
        .tz('Asia/Ho_Chi_Minh')
        .subtract(this.config.get_transaction_day_limit, 'days')
        .format('DD/MM/YYYY');
      const toDate = moment().tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY');

      const data = await this.makeRequest<TransactionDto>(
        '/bank-service/v1/transaction-history',
        {
          accountNo: this.config.account,
          accountType: 'D',
          fromDate,
          toDate,
          pageIndex: 0,
          lengthInPage: this.config.get_transaction_count_limit,
          mid: 14,
          lang: 'vi',
          user: this.config.login_id,
          cif: this.cif,
          mobileId: this.mobileId,
          clientId: this.clientId,
          browserId: this.config.device_id,
          E: null,
          sessionId: this.sessionId,
          DT: 'Windows',
          PM: this.browserVersion,
          OV: '10',
          appVersion: '',
        },
      );

      // PostingDate: '2024-06-28',
      // PostingTime: '050359',
      const getDate = (PostingDate: string, PostingTime: string): Date => {
        const time = PostingTime.match(/.{1,2}/g);
        return moment
          .tz(
            PostingDate + ' ' + time.join(':'),
            'YYYY-MM-DD HH:mm:ss',
            'Asia/Ho_Chi_Minh',
          )
          .toDate();
      };

      // Handle VCB error responses
      if (!data || data.code !== undefined) {
        if (data?.code === '108') {
          this.error108Count++;
          const errorMsg = `VCB Multiple Device Access Detected (${this.error108Count}/3) - Account: ${this.config.account}`;
          this.lastError = errorMsg;
          console.warn(errorMsg);
          console.warn('VCB Error Details:', data);
          
          // Clear all session data
          this.sessionId = null;
          this.cif = null;
          this.mobileId = null;
          this.clientId = null;
          
          // Progressive backoff strategy
          const waitTime = Math.min(30000 + (this.error108Count * 15000), 120000); // Max 2 minutes
          console.log(`Waiting ${waitTime/1000}s before retry...`);
          await sleep(waitTime);
          
          // If we've had too many 108 errors, suggest manual intervention
          if (this.error108Count >= 3) {
            console.error('=== VCB TROUBLESHOOTING REQUIRED ===');
            console.error(`Account: ${this.config.account}`);
            console.error(`Device ID: ${this.config.device_id}`);
            console.error(`Login ID: ${this.config.login_id}`);
            console.error('Suggested actions:');
            console.error('1. Check if VCB account is being used elsewhere');
            console.error('2. Wait 5-10 minutes before restarting');
            console.error('3. Generate new device_id: /gateways/vcb-test');
            console.error('4. Verify VCB credentials in config.yml');
            console.error('====================================');
          }
        } else if (data?.code === '005') {
          const errorMsg = 'VCB Session expired - Will re-login';
          this.lastError = errorMsg;
          console.warn(errorMsg);
          this.sessionId = null;
        } else {
          const errorMsg = `VCB API error ${data?.code}: ${data?.des || 'Unknown error'}`;
          this.lastError = errorMsg;
          console.warn(errorMsg);
          console.warn('Full VCB Error:', data);
        }
        return [];
      }

      // Handle cases where transactions might be undefined or null
      if (!data.transactions || !Array.isArray(data.transactions)) {
        console.warn('VCB API returned no transaction data');
        console.warn('Response structure:', Object.keys(data));
        return [];
      }

      const payments = data.transactions
        .filter((t) => t && t.CD === '+')
        .map((t) => ({
          transaction_id: 'vcbbank-' + t.Reference,
          content: t.Description,
          amount: parseFloat(t.Amount.replaceAll(',', '')),
          date: getDate(t.PostingDate, t.PostingTime),
          gate: GateType.VCBBANK,
          account_receiver: this.config.account,
        }));

      if (payments.length > 0) {
        console.log(`VCB Success: Retrieved ${payments.length} transactions for account ${this.config.account}`);
        this.lastError = null; // Clear error on successful transaction fetch
      } else {
        console.log(`VCB Info: No new transactions found for account ${this.config.account}`);
      }

      return payments;
    } catch (error) {
      const errorMsg = `VCB Error fetching transactions: ${error.message}`;
      this.lastError = errorMsg;
      console.error(errorMsg);
      console.error('Full error:', error);

      if (
        error.message.includes(
          'Client network socket disconnected before secure TLS connection was established',
        )
      ) {
        console.log('Network issue detected, waiting 10s...');
        await sleep(10000);
      } else {
        console.log('Clearing session due to error');
        this.sessionId = null;
      }

      throw new Error(errorMsg);
    }
  }
}
