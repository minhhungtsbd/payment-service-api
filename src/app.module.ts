import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PaymentConfigModule } from './payment-config/payment-config.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhookModule } from './webhook/webhook.module';
import { BotModule } from './bots/bots.module';
import { queueUIMiddleware } from './shards/middlewares/queues.middleware';
import { CaptchaSolverModule } from './captcha-solver/captcha-solver.module';
import { ProxyModule } from './proxy/proxy.module';
import { PaymentEntity } from './payments/payment.entity';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
        PORT: Joi.number().default(3000),
        CAPTCHA_API_BASE_URL: Joi.string().required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        SERVICE_DOMAIN: Joi.string().domain().optional(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [PaymentEntity],
        synchronize: true, // Tự động tạo table
        logging: false,
        charset: 'utf8mb4',
        timezone: 'Z',
      }),
      inject: [ConfigService],
    }),
    PaymentConfigModule,
    PaymentsModule,
    WebhookModule,
    BotModule,
    CaptchaSolverModule,
    ProxyModule,
  ],
  providers: [],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        queueUIMiddleware({
          host: this.configService.get<string>('REDIS_HOST') || 'localhost',
          port: this.configService.get<number>('REDIS_PORT') || 6379,
        }),
      )
      .forRoutes('/admin/queues');
  }
}
