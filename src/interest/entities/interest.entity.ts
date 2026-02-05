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

@Table({
  tableName: 'interest_records',
  timestamps: true,
  underscored: true,
})
export class InterestRecord extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING)
  accountId: string; // Reference to account/wallet

  @AllowNull(false)
  @Column(DataType.DECIMAL(20, 2))
  principalAmount: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(10, 8))
  annualRate: string; // Stored as percentage (e.g., 27.5)

  @AllowNull(false)
  @Column(DataType.DECIMAL(12, 10))
  dailyRate: string; // Calculated daily rate with high precision

  @AllowNull(false)
  @Column(DataType.DECIMAL(20, 2))
  interestAmount: string; // Daily interest earned

  @AllowNull(false)
  @Index
  @Column(DataType.DATEONLY)
  calculationDate: Date;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  isLeapYear: boolean;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  daysInYear: number; // 365 or 366

  @Column(DataType.JSONB)
  metadata: Record<string, any>;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}
