import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  Index,
  AllowNull,
} from 'sequelize-typescript';

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export enum TransactionType {
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  REFUND = 'REFUND',
}

@Table({
  tableName: 'transaction_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['idempotency_key'],
    },
  ],
})
export class TransactionLog extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Index({ unique: true })
  @Column(DataType.STRING)
  idempotencyKey: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(TransactionType)))
  type: TransactionType;

  @AllowNull(false)
  @Index
  @Column(DataType.UUID)
  fromWalletId: string;

  @AllowNull(false)
  @Index
  @Column(DataType.UUID)
  toWalletId: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(20, 2))
  amount: string;

  @AllowNull(false)
  @Default('NGN')
  @Column(DataType.STRING(3))
  currency: string;

  @AllowNull(false)
  @Default(TransactionStatus.PENDING)
  @Index
  @Column(DataType.ENUM(...Object.values(TransactionStatus)))
  status: TransactionStatus;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.TEXT)
  errorMessage: string;

  @Column(DataType.JSONB)
  metadata: Record<string, any>;

  @Column(DataType.DATE)
  completedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;

  // Helper methods
  isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === TransactionStatus.FAILED;
  }

  isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  canBeProcessed(): boolean {
    return (
      this.status === TransactionStatus.PENDING ||
      this.status === TransactionStatus.PROCESSING
    );
  }
}
