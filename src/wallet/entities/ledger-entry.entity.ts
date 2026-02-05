import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  CreatedAt,
  Index,
  AllowNull,
  ForeignKey,
  UpdatedAt,
} from 'sequelize-typescript';
import { TransactionLog } from './transaction-log.entity';
import { Wallet } from './wallet.entity';

export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/**
 * Double-entry bookkeeping ledger
 * Every transaction creates two entries: one debit and one credit
 * This ensures accounting accuracy and provides audit trail
 */
@Table({
  tableName: 'ledger_entries',
  timestamps: true,
  underscored: true,
})
export class LedgerEntry extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @ForeignKey(() => TransactionLog)
  @Index
  @Column(DataType.UUID)
  transactionId: string;

  @AllowNull(false)
  @ForeignKey(() => Wallet)
  @Index
  @Column(DataType.UUID)
  walletId: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(LedgerEntryType)))
  type: LedgerEntryType;

  @AllowNull(false)
  @Column(DataType.DECIMAL(20, 2))
  amount: string;

  @AllowNull(false)
  @Default('NGN')
  @Column(DataType.STRING(3))
  currency: string;

  // Balance after this entry (for audit purposes)
  @AllowNull(false)
  @Column(DataType.DECIMAL(20, 2))
  balanceAfter: string;

  @Column(DataType.TEXT)
  description: string;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;

  // Helper methods
  isDebit(): boolean {
    return this.type === LedgerEntryType.DEBIT;
  }

  isCredit(): boolean {
    return this.type === LedgerEntryType.CREDIT;
  }
}
