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

export enum WalletType {
  POOL = 'POOL',
  USER = 'USER',
  MERCHANT = 'MERCHANT',
}

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

@Table({
  tableName: 'wallets',
  timestamps: true,
  underscored: true,
})
export class Wallet extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING)
  ownerId: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(WalletType)))
  type: WalletType;

  @AllowNull(false)
  @Default('0.00')
  @Column(DataType.DECIMAL(20, 2))
  balance: string;

  @AllowNull(false)
  @Default('NGN')
  @Column(DataType.STRING(3))
  currency: string;

  @AllowNull(false)
  @Default(WalletStatus.ACTIVE)
  @Column(DataType.ENUM(...Object.values(WalletStatus)))
  status: WalletStatus;

  // Optimistic locking - prevents race conditions on concurrent updates
  @AllowNull(false)
  @Default(1)
  @Column(DataType.INTEGER)
  version: number;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;

  // Helper methods
  hasAvailableBalance(amount: string): boolean {
    const balance = parseFloat(this.balance);
    const requiredAmount = parseFloat(amount);
    return balance >= requiredAmount;
  }

  isActive(): boolean {
    return this.status === WalletStatus.ACTIVE;
  }
}
