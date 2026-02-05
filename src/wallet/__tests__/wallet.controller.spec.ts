import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from '../wallet.controller';
import { WalletService } from '../wallet.service';

describe('WalletController', () => {
  let controller: WalletController;
  let service: WalletService;

  const mockWalletService = {
    transfer: jest.fn(),
    getWallet: jest.fn(),
    getTransactionHistory: jest.fn(),
    getAllWallets: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
    service = module.get<WalletService>(WalletService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('transfer', () => {
    it('should call walletService.transfer and return result', async () => {
      const transferDto = {
        idempotencyKey: 'test-key',
        fromWalletId: 'wallet-1',
        toWalletId: 'wallet-2',
        amount: '100.00',
        currency: 'NGN',
        description: 'Test',
      };

      const expectedResult = {
        success: true,
        transactionId: 'txn-123',
        status: 'COMPLETED',
        fromWallet: { id: 'wallet-1', newBalance: '900.00' },
        toWallet: { id: 'wallet-2', newBalance: '600.00' },
        timestamp: new Date(),
      };

      mockWalletService.transfer.mockResolvedValue(expectedResult);

      const result = await controller.transfer(transferDto);

      expect(service.transfer).toHaveBeenCalledWith(transferDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getWallet', () => {
    it('should call walletService.getWallet and return result', async () => {
      const mockWallet = {
        id: 'wallet-1',
        balance: '1000.00',
        currency: 'NGN',
      };

      mockWalletService.getWallet.mockResolvedValue(mockWallet);

      const result = await controller.getWallet('wallet-1');

      expect(service.getWallet).toHaveBeenCalledWith('wallet-1');
      expect(result).toEqual(mockWallet);
    });
  });

  describe('getHistory', () => {
    it('should call walletService.getTransactionHistory and return result', async () => {
      const mockTransactions = [
        { id: 'txn-1', amount: '100.00' },
        { id: 'txn-2', amount: '200.00' },
      ];

      mockWalletService.getTransactionHistory.mockResolvedValue(
        mockTransactions,
      );

      const result = await controller.getHistory('wallet-1');

      expect(service.getTransactionHistory).toHaveBeenCalledWith('wallet-1');
      expect(result).toEqual({ transactions: mockTransactions });
    });
  });
});
