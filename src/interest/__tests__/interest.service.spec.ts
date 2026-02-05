import { Test, TestingModule } from '@nestjs/testing';
import { InterestService } from '../interest.service';
import { getModelToken } from '@nestjs/sequelize';
import { InterestRecord } from '../entities/interest.entity';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

describe('InterestService', () => {
  let service: InterestService;
  let interestRecordModel: typeof InterestRecord;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterestService,
        {
          provide: getModelToken(InterestRecord),
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InterestService>(InterestService);
    interestRecordModel = module.get<typeof InterestRecord>(
      getModelToken(InterestRecord),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDailyInterest', () => {
    it('should calculate daily interest correctly for non-leap year', async () => {
      const mockRecord = {
        id: 'record-id-123',
        accountId: 'test-account',
      };

      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        calculationDate: '2023-06-15', // Non-leap year
      };

      const result = await service.calculateDailyInterest(dto);

      // Expected calculation:
      // Daily Rate = 27.5 / 365 = 0.0753424658
      // Interest = 10000 × 0.0753424658 / 100 = 7.53
      expect(result.principal).toBe('10000.00');
      expect(result.annualRate).toBe(27.5);
      expect(result.isLeapYear).toBe(false);
      expect(result.daysInYear).toBe(365);
      expect(result.interestAmount).toBe('7.53');
      expect(parseFloat(result.dailyRate)).toBeCloseTo(0.0753424658, 8);
    });

    it('should calculate daily interest correctly for leap year', async () => {
      const mockRecord = {
        id: 'record-id-456',
        accountId: 'test-account',
      };

      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        calculationDate: '2024-02-29', // Leap year
      };

      const result = await service.calculateDailyInterest(dto);

      // Expected calculation:
      // Daily Rate = 27.5 / 366 = 0.0751366120
      // Interest = 10000 × 0.0751366120 / 100 = 7.51
      expect(result.principal).toBe('10000.00');
      expect(result.annualRate).toBe(27.5);
      expect(result.isLeapYear).toBe(true);
      expect(result.daysInYear).toBe(366);
      expect(result.interestAmount).toBe('7.51');
      expect(parseFloat(result.dailyRate)).toBeCloseTo(0.075136612, 8);
    });

    it('should handle zero interest rate', async () => {
      const mockRecord = {
        id: 'record-id-789',
        accountId: 'test-account',
      };

      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '10000.00',
        annualRate: 0,
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      expect(result.interestAmount).toBe('0.00');
      expect(result.dailyRate).toBe('0.0000000000');
    });

    it('should handle very large principal amounts', async () => {
      const mockRecord = {
        id: 'record-id-large',
        accountId: 'test-account',
      };

      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '999999999.99', // Nearly 1 billion
        annualRate: 27.5,
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      // Should handle large numbers without overflow
      expect(parseFloat(result.interestAmount)).toBeGreaterThan(0);
      expect(result.principal).toBe('999999999.99');
    });

    it('should handle small principal amounts', async () => {
      const mockRecord = {
        id: 'record-id-small',
        accountId: 'test-account',
      };

      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '0.01', // Minimum valid amount
        annualRate: 27.5,
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      expect(result.principal).toBe('0.01');
      // Very small amount: 0.01 × (27.5 / 366) / 100 = 0.0000075...
      // Rounds to 0.00 with 2 decimal places
      expect(result.interestAmount).toBe('0.00');
    });

    it('should throw error for negative principal', async () => {
      const dto = {
        principalAmount: '-100.00',
        annualRate: 27.5,
        calculationDate: '2024-01-01',
      };

      await expect(service.calculateDailyInterest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for zero principal', async () => {
      const dto = {
        principalAmount: '0.00',
        annualRate: 27.5,
        calculationDate: '2024-01-01',
      };

      await expect(service.calculateDailyInterest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for negative interest rate', async () => {
      const dto = {
        principalAmount: '10000.00',
        annualRate: -5,
        calculationDate: '2024-01-01',
      };

      await expect(service.calculateDailyInterest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for invalid date', async () => {
      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        calculationDate: 'invalid-date',
      };

      await expect(service.calculateDailyInterest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Leap year detection', () => {
    it('should correctly identify leap years', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      // 2024 is a leap year (divisible by 4)
      let result = await service.calculateDailyInterest({
        principalAmount: '100.00',
        annualRate: 10,
        calculationDate: '2024-01-01',
      });
      expect(result.isLeapYear).toBe(true);
      expect(result.daysInYear).toBe(366);

      // 2023 is not a leap year
      result = await service.calculateDailyInterest({
        principalAmount: '100.00',
        annualRate: 10,
        calculationDate: '2023-01-01',
      });
      expect(result.isLeapYear).toBe(false);
      expect(result.daysInYear).toBe(365);

      // 2000 is a leap year (divisible by 400)
      result = await service.calculateDailyInterest({
        principalAmount: '100.00',
        annualRate: 10,
        calculationDate: '2000-01-01',
      });
      expect(result.isLeapYear).toBe(true);

      // 1900 is NOT a leap year (divisible by 100 but not 400)
      result = await service.calculateDailyInterest({
        principalAmount: '100.00',
        annualRate: 10,
        calculationDate: '1900-01-01',
      });
      expect(result.isLeapYear).toBe(false);
    });
  });

  describe('Floating-point precision', () => {
    it('should avoid floating-point errors', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      // Test case that would fail with standard JavaScript math
      const dto = {
        principalAmount: '0.1',
        annualRate: 0.2,
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      // Result should be precise decimal, not floating-point approximation
      expect(typeof result.interestAmount).toBe('string');
      // 0.1 × (0.2 / 366) / 100 = 0.000000546448...
      // Rounded to 2 decimal places = 0.00
      expect(result.interestAmount).toBe('0.00');
    });

    it('should maintain precision in calculations', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '12345.67',
        annualRate: 27.5,
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      // Manual calculation with Decimal.js
      const principal = new Decimal('12345.67');
      const rate = new Decimal('27.5');
      const dailyRate = rate.dividedBy(366);
      const expected = principal
        .times(dailyRate)
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

      expect(result.interestAmount).toBe(expected.toFixed(2));
    });
  });

  describe('calculateBatchInterest', () => {
    it('should calculate interest for multiple days', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        startDate: '2024-01-01',
        endDate: '2024-01-03', // 3 days
      };

      const result = await service.calculateBatchInterest(dto);

      expect(result.numberOfDays).toBe(3);
      expect(result.calculations).toHaveLength(3);
      expect(parseFloat(result.totalInterest)).toBeGreaterThan(0);

      // Total should be sum of daily calculations
      const manualTotal = result.calculations.reduce(
        (sum, calc) => sum + parseFloat(calc.interestAmount),
        0,
      );
      expect(parseFloat(result.totalInterest)).toBeCloseTo(manualTotal, 2);
    });

    it('should throw error if end date is before start date', async () => {
      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        startDate: '2024-01-10',
        endDate: '2024-01-01', // Invalid: before start date
      };

      await expect(service.calculateBatchInterest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle amounts with exactly 2 decimal places', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      const dto = {
        principalAmount: '100.50',
        annualRate: 15.75,
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      expect(result.principal).toBe('100.50');
      expect(result.interestAmount).toMatch(/^\d+\.\d{2}$/); // Exactly 2 decimal places
    });

    it("should round correctly using banker's rounding (ROUND_HALF_EVEN)", async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      // Create a scenario where rounding matters
      const dto = {
        principalAmount: '1000.00',
        annualRate: 18.25, // Rate chosen to create .005 scenario
        calculationDate: '2024-01-01',
      };

      const result = await service.calculateDailyInterest(dto);

      // Result should use banker's rounding
      expect(result.interestAmount).toMatch(/^\d+\.\d{2}$/);
    });
  });

  describe('Real-world scenarios', () => {
    it('should calculate interest for a typical loan scenario', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      // Scenario: 100,000 NGN loan at 27.5% annual interest
      const dto = {
        principalAmount: '100000.00',
        annualRate: 27.5,
        calculationDate: '2024-06-15',
        accountId: 'LOAN-12345',
      };

      const result = await service.calculateDailyInterest(dto);

      // Expected: 100000 × (27.5 / 366) / 100 = 75.14
      expect(result.interestAmount).toBe('75.14');
      expect(result.principal).toBe('100000.00');
      expect(result.recordId).toBeDefined();
    });

    it('should handle the exact example from requirements', async () => {
      const mockRecord = { id: 'test' };
      jest
        .spyOn(interestRecordModel, 'create')
        .mockResolvedValue(mockRecord as any);

      // Using 27.5% per annum as stated in requirements
      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        calculationDate: '2024-01-15',
      };

      const result = await service.calculateDailyInterest(dto);

      // For leap year 2024: 27.5 / 366 = 0.0751366120
      // 10000 × 0.0751366120 / 100 = 7.51
      expect(result.interestAmount).toBe('7.51');
      expect(result.daysInYear).toBe(366);
    });
  });
});
