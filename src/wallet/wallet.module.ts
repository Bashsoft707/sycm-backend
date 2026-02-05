import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { TransactionLog } from './entities/transaction-log.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';

@Module({
  imports: [SequelizeModule.forFeature([Wallet, TransactionLog, LedgerEntry])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
