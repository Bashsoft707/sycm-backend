import { Test, TestingModule } from '@nestjs/testing';
import { InterestController } from '../interest.controller';
import { InterestService } from '../interest.service';

describe('InterestController', () => {
  let controller: InterestController;
  let service: InterestService;

  const mockInterestService = {
    calculateDailyInterest: jest.fn(),
    calculateBatchInterest: jest.fn(),
    getInterestHistory: jest.fn(),
    getTotalInterest: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterestController],
      providers: [
        {
          provide: InterestService,
          useValue: mockInterestService,
        },
      ],
    }).compile();

    controller = module.get<InterestController>(InterestController);
    service = module.get<InterestService>(InterestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('calculateDailyInterest', () => {
    it('should call interestService.calculateDailyInterest and return result', async () => {
      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        calculationDate: '2024-01-01',
      };

      const expectedResult = {
        principal: '10000.00',
        annualRate: 27.5,
        dailyRate: '0.0751366120',
        interestAmount: '7.51',
        calculationDate: '2024-01-01',
        isLeapYear: true,
        daysInYear: 366,
        recordId: 'record-123',
      };

      mockInterestService.calculateDailyInterest.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.calculateDailyInterest(dto);

      expect(service.calculateDailyInterest).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('calculateBatchInterest', () => {
    it('should call interestService.calculateBatchInterest and return result', async () => {
      const dto = {
        principalAmount: '10000.00',
        annualRate: 27.5,
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      };

      const expectedResult = {
        totalInterest: '22.53',
        numberOfDays: 3,
        calculations: [],
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      };

      mockInterestService.calculateBatchInterest.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.calculateBatchInterest(dto);

      expect(service.calculateBatchInterest).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getHistory', () => {
    it('should call interestService.getInterestHistory and return result', async () => {
      const mockRecords = [
        { id: 'record-1', interestAmount: '7.51' },
        { id: 'record-2', interestAmount: '7.51' },
      ];

      mockInterestService.getInterestHistory.mockResolvedValue(mockRecords);

      const result = await controller.getHistory('account-123', 30);

      expect(service.getInterestHistory).toHaveBeenCalledWith(
        'account-123',
        30,
      );
      expect(result).toEqual({ records: mockRecords });
    });
  });

  describe('getTotalInterest', () => {
    it('should call interestService.getTotalInterest and return result', async () => {
      const expectedResult = {
        totalInterest: '225.30',
        recordCount: 30,
      };

      mockInterestService.getTotalInterest.mockResolvedValue(expectedResult);

      const result = await controller.getTotalInterest(
        'account-123',
        '2024-01-01',
        '2024-01-30',
      );

      expect(service.getTotalInterest).toHaveBeenCalledWith(
        'account-123',
        '2024-01-01',
        '2024-01-30',
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
