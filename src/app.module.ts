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
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        SERVICE_DOMAIN: Joi.string().domain().optional(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [PaymentEntity],
        synchronize: true, // Tự động tạo table
        logging: false,
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
