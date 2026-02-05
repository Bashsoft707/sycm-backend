import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { Dialect } from 'sequelize';
import { WalletModule } from './wallet/wallet.module';
import { InterestModule } from './interest/interest.module';
import { Wallet, TransactionLog, LedgerEntry } from './wallet/entities';
import { InterestRecord } from './interest/entities/interest.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbConfig = {
          dialect: 'postgres' as Dialect,
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE'),
          models: [Wallet, TransactionLog, LedgerEntry, InterestRecord],
          autoLoadModels: true,
          synchronize: false,
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          },
          logging: config.get('DB_LOGGING') === 'true' ? console.log : false,
          pool: {
            max: 20,
            min: 5,
            acquire: 30000,
            idle: 10000,
          },
        };

        return dbConfig;
      },
    }),

    WalletModule,
    InterestModule,
  ],
})
export class AppModule {}
