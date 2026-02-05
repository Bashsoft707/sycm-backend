import {
  IsNotEmpty,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateDailyInterestDto {
  @ApiProperty({
    description: 'The principal amount on which interest is calculated',
    example: '1000.00',
  })
  @IsNotEmpty({ message: 'Principal amount is required' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value;
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Principal must have at most 2 decimal places' },
  )
  @Min(0.01, { message: 'Principal amount must be greater than 0' })
  principalAmount: string;

  @ApiProperty({
    description: 'The annual interest rate as a percentage',
    example: 5,
  })
  @IsNotEmpty({ message: 'Annual rate is required' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value;
  })
  @IsNumber({}, { message: 'Annual rate must be a number' })
  @Min(0, { message: 'Annual rate cannot be negative' })
  @Max(100, { message: 'Annual rate cannot exceed 100%' })
  annualRate: number;

  @ApiProperty({
    description: 'The date for which to calculate interest (YYYY-MM-DD)',
    example: '2024-06-30',
  })
  @IsNotEmpty({ message: 'Calculation date is required' })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  calculationDate: string;

  @ApiProperty({
    description: 'Optional account ID for associating the interest record',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  accountId?: string;
}

export class InterestCalculationResponseDto {
  principal: string;
  annualRate: number;
  dailyRate: string;
  interestAmount: string;
  calculationDate: string;
  isLeapYear: boolean;
  daysInYear: number;
  recordId?: string;
}

export class BatchCalculateInterestDto {
  @ApiProperty({
    description: 'The principal amount on which interest is calculated',
    example: '1000.00',
  })
  @IsNotEmpty({ message: 'Principal amount is required' })
  principalAmount: string;

  @ApiProperty({
    description: 'The annual interest rate as a percentage',
    example: 5,
  })
  @IsNotEmpty({ message: 'Annual rate is required' })
  @IsNumber({}, { message: 'Annual rate must be a number' })
  @Min(0, { message: 'Annual rate cannot be negative' })
  @Max(100, { message: 'Annual rate cannot exceed 100%' })
  annualRate: number;

  @ApiProperty({
    description: 'Start date for the interest calculation (YYYY-MM-DD)',
    example: '2024-06-01',
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the interest calculation (YYYY-MM-DD)',
    example: '2024-06-30',
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Optional account ID for associating the interest records',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  accountId?: string;
}

export class BatchInterestResponseDto {
  totalInterest: string;
  numberOfDays: number;
  calculations: InterestCalculationResponseDto[];
  startDate: string;
  endDate: string;
}
