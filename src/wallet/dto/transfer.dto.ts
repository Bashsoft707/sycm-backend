import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({
    description: 'A unique key to ensure idempotency of the transfer request',
    example: 'transfer-12345-unique-key',
  })
  @IsNotEmpty({ message: 'Idempotency key is required' })
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\-_]+$/, {
    message:
      'Idempotency key must contain only alphanumeric characters, hyphens, and underscores',
  })
  idempotencyKey: string;

  @ApiProperty({
    description: 'The ID of the source wallet (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Source wallet ID is required' })
  // @IsUUID()
  fromWalletId: string;

  @ApiProperty({
    description: 'The ID of the destination wallet (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty({ message: 'Destination wallet ID is required' })
  // @IsUUID()
  toWalletId: string;

  @ApiProperty({
    description: 'The amount to transfer',
    example: '100.00',
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @Transform(({ value }) => {
    // Transform string to number for validation
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value;
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must have at most 2 decimal places' },
  )
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: string;

  @ApiProperty({
    description: 'Optional currency code (3-letter ISO format)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a 3-letter uppercase code',
  })
  currency?: string = 'NGN';

  @ApiProperty({
    description: 'Optional description for the transfer',
    example: 'Payment for services rendered',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Optional metadata for the transfer',
    example: { orderId: 'ORD-98765', notes: 'Urgent transfer' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TransferResponseDto {
  success: boolean;
  transactionId: string;
  status: string;
  fromWallet: {
    id: string;
    newBalance: string;
  };
  toWallet: {
    id: string;
    newBalance: string;
  };
  timestamp: Date;
  message?: string;
}
