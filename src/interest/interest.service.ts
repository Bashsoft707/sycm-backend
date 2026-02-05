import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { InterestRecord } from './entities/interest.entity';
import {
  CalculateDailyInterestDto,
  InterestCalculationResponseDto,
  BatchCalculateInterestDto,
  BatchInterestResponseDto,
} from './dto/interest.dto';
import Decimal from 'decimal.js';
import { Op } from 'sequelize';

/**
 * Interest Accumulator Service
 * Calculates daily interest with high precision to avoid floating-point errors
 * Formula: Daily Interest = Principal × (Annual Rate / Days in Year)
 * Handles leap years correctly
 */
@Injectable()
export class InterestService {
  private readonly logger = new Logger(InterestService.name);

  // Configure Decimal.js for financial calculations
  private readonly DECIMAL_CONFIG = {
    precision: 20, // 20 significant digits
    rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding
  };

  constructor(
    @InjectModel(InterestRecord)
    private interestRecordModel: typeof InterestRecord,
  ) {
    // Apply Decimal configuration globally
    Decimal.set(this.DECIMAL_CONFIG);
  }

  /**
   * Calculate daily interest for a given principal amount and date
   * @param dto - Calculation parameters
   * @returns Interest calculation result with high precision
   */
  async calculateDailyInterest(
    dto: CalculateDailyInterestDto,
  ): Promise<InterestCalculationResponseDto> {
    this.logger.log(
      `Calculating daily interest for principal: ${dto.principalAmount}, rate: ${dto.annualRate}%, date: ${dto.calculationDate}`,
    );

    // Validate input
    this.validateInput(dto);

    try {
      // Parse calculation date
      const calculationDate = new Date(dto.calculationDate);

      // Determine if leap year
      const year = calculationDate.getFullYear();
      const isLeapYear = this.isLeapYear(year);
      const daysInYear = isLeapYear ? 366 : 365;

      // Use Decimal for all calculations to prevent floating-point errors
      const principal = new Decimal(dto.principalAmount);
      const annualRate = new Decimal(dto.annualRate);

      // Calculate daily rate: Annual Rate / Days in Year
      const dailyRate = annualRate.dividedBy(daysInYear);

      // Calculate interest amount: Principal × Daily Rate / 100
      const interestAmount = principal
        .times(dailyRate)
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

      // Prepare response
      const response: InterestCalculationResponseDto = {
        principal: principal.toFixed(2),
        annualRate: dto.annualRate,
        dailyRate: dailyRate.toFixed(10), // High precision for daily rate
        interestAmount: interestAmount.toFixed(2),
        calculationDate: dto.calculationDate,
        isLeapYear,
        daysInYear,
      };

      // Save to database for audit trail
      const record = await this.saveInterestRecord({
        accountId: dto.accountId || 'default',
        principalAmount: response.principal,
        annualRate: annualRate.toFixed(8),
        dailyRate: response.dailyRate,
        interestAmount: response.interestAmount,
        calculationDate,
        isLeapYear,
        daysInYear,
      });

      response.recordId = record.id;

      this.logger.log(
        `Daily interest calculated: ${response.interestAmount} (Record ID: ${record.id})`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Interest calculation failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to calculate interest: ${error.message}`,
      );
    }
  }

  /**
   * Calculate interest for a date range (batch calculation)
   * @param dto - Batch calculation parameters
   * @returns Aggregated interest calculation for the period
   */
  async calculateBatchInterest(
    dto: BatchCalculateInterestDto,
  ): Promise<BatchInterestResponseDto> {
    this.logger.log(
      `Calculating batch interest from ${dto.startDate} to ${dto.endDate}`,
    );

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const calculations: InterestCalculationResponseDto[] = [];
    let totalInterest = new Decimal(0);
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      const dailyCalc = await this.calculateDailyInterest({
        principalAmount: dto.principalAmount,
        annualRate: dto.annualRate,
        calculationDate: dateStr,
        accountId: dto.accountId,
      });

      calculations.push(dailyCalc);
      totalInterest = totalInterest.plus(dailyCalc.interestAmount);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      totalInterest: totalInterest.toFixed(2),
      numberOfDays: calculations.length,
      calculations,
      startDate: dto.startDate,
      endDate: dto.endDate,
    };
  }

  /**
   * Determine if a year is a leap year
   * Rules:
   * - Divisible by 4: leap year
   * - EXCEPT if divisible by 100: not a leap year
   * - EXCEPT if divisible by 400: leap year
   */
  private isLeapYear(year: number): boolean {
    if (year % 400 === 0) {
      return true;
    }
    if (year % 100 === 0) {
      return false;
    }
    if (year % 4 === 0) {
      return true;
    }
    return false;
  }

  /**
   * Validate input parameters
   */
  private validateInput(dto: CalculateDailyInterestDto): void {
    const principal = parseFloat(dto.principalAmount);

    if (principal <= 0) {
      throw new BadRequestException('Principal amount must be greater than 0');
    }

    if (principal > 1000000000) {
      throw new BadRequestException(
        'Principal amount exceeds maximum allowed value',
      );
    }

    if (dto.annualRate < 0) {
      throw new BadRequestException('Annual rate cannot be negative');
    }

    if (dto.annualRate > 100) {
      throw new BadRequestException('Annual rate cannot exceed 100%');
    }

    // Validate date format
    const date = new Date(dto.calculationDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid calculation date');
    }

    // Check if date is not in the future (optional business rule)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      this.logger.warn(
        `Calculation date is in the future: ${dto.calculationDate}`,
      );
      // Note: Not throwing error, as future projections might be valid
    }
  }

  /**
   * Save interest record to database for audit trail
   */
  private async saveInterestRecord(data: {
    accountId: string;
    principalAmount: string;
    annualRate: string;
    dailyRate: string;
    interestAmount: string;
    calculationDate: Date;
    isLeapYear: boolean;
    daysInYear: number;
  }): Promise<InterestRecord> {
    return await this.interestRecordModel.create({
      accountId: data.accountId,
      principalAmount: data.principalAmount,
      annualRate: data.annualRate,
      dailyRate: data.dailyRate,
      interestAmount: data.interestAmount,
      calculationDate: data.calculationDate,
      isLeapYear: data.isLeapYear,
      daysInYear: data.daysInYear,
      metadata: {},
    });
  }

  /**
   * Get interest history for an account
   */
  async getInterestHistory(
    accountId: string,
    limit = 30,
  ): Promise<InterestRecord[]> {
    return await this.interestRecordModel.findAll({
      where: { accountId },
      order: [['calculationDate', 'DESC']],
      limit,
    });
  }

  /**
   * Get total interest earned for an account in a date range
   */
  async getTotalInterest(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ totalInterest: string; recordCount: number }> {
    const records = await this.interestRecordModel.findAll({
      where: {
        accountId,
        calculationDate: {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        },
      },
    });

    let total = new Decimal(0);
    records.forEach((record) => {
      total = total.plus(record.interestAmount);
    });

    return {
      totalInterest: total.toFixed(2),
      recordCount: records.length,
    };
  }

  /**
   * Calculate compound interest (for future enhancement)
   * This demonstrates how the service can be extended
   */
  async calculateCompoundInterest(
    principal: string,
    annualRate: number,
    days: number,
  ): Promise<string> {
    const principalDecimal = new Decimal(principal);
    const rate = new Decimal(annualRate).dividedBy(100);

    // Compound formula: A = P(1 + r/n)^(nt)
    // For daily compounding: n = 365 or 366
    const year = new Date().getFullYear();
    const n = this.isLeapYear(year) ? 366 : 365;
    const t = new Decimal(days).dividedBy(n);

    const amount = principalDecimal.times(
      new Decimal(1).plus(rate.dividedBy(n)).pow(new Decimal(n).times(t)),
    );

    const totalInterest = amount.minus(principalDecimal);

    return totalInterest.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toFixed(2);
  }
}
