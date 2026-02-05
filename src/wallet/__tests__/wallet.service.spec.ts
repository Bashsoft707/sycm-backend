import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../wallet.service';
import { getModelToken } from '@nestjs/sequelize';
import { Wallet } from '../entities/wallet.entity';
import { TransactionLog } from '../entities/transaction-log.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { WalletStatus, WalletType } from '../entities/wallet.entity';
import { TransactionStatus } from '../entities/transaction-log.entity';
import { Sequelize } from 'sequelize-typescript';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let walletModel: typeof Wallet;
  let transactionLogModel: typeof TransactionLog;
  let ledgerEntryModel: typeof LedgerEntry;
  let sequelize: Sequelize;

  // Mock data
  const mockFromWallet = {
    id: 'from-wallet-id',
    ownerId: 'user-1',
    type: WalletType.USER,
    balance: '1000.00',
    currency: 'NGN',
    status: WalletStatus.ACTIVE,
    version: 1,
    hasAvailableBalance: jest.fn().mockReturnValue(true),
    isActive: jest.fn().mockReturnValue(true),
    update: jest.fn(),
  };

  const mockToWallet = {
    id: 'to-wallet-id',
    ownerId: 'user-2',
    type: WalletType.USER,
    balance: '500.00',
    currency: 'NGN',
    status: WalletStatus.ACTIVE,
    version: 1,
    hasAvailableBalance: jest.fn().mockReturnValue(true),
    isActive: jest.fn().mockReturnValue(true),
    update: jest.fn(),
  };

  const mockTransactionLog = {
    id: 'transaction-id',
    idempotencyKey: 'test-key-123',
    fromWalletId: 'from-wallet-id',
    toWalletId: 'to-wallet-id',
    amount: '100.00',
    currency: 'NGN',
    status: TransactionStatus.PENDING,
    update: jest.fn(),
    isCompleted: jest.fn().mockReturnValue(false),
  };

  const mockTransferDto = {
    idempotencyKey: 'test-key-123',
    fromWalletId: 'from-wallet-id',
    toWalletId: 'to-wallet-id',
    amount: '100.00',
    currency: 'NGN',
    description: 'Test transfer',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getModelToken(Wallet),
          useValue: {
            findByPk: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: getModelToken(TransactionLog),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: getModelToken(LedgerEntry),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: Sequelize,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletModel = module.get<typeof Wallet>(getModelToken(Wallet));
    transactionLogModel = module.get<typeof TransactionLog>(
      getModelToken(TransactionLog),
    );
    ledgerEntryModel = module.get<typeof LedgerEntry>(
      getModelToken(LedgerEntry),
    );
    sequelize = module.get<Sequelize>(Sequelize);

    // Global Redis Mock
    (service as any)['redis'] = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    // Reusable mock transaction object
    const mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      LOCK: { UPDATE: 'UPDATE' },
    };

    beforeEach(() => {
      // Simulate Sequelize Managed Transaction Behavior
      jest
        .spyOn(sequelize, 'transaction')
        .mockImplementation(async (arg1: any, arg2?: any) => {
          const callback = typeof arg1 === 'function' ? arg1 : arg2;

          try {
            const result = await callback(mockTransaction);
            // Simulate successful commit
            await mockTransaction.commit();
            return result;
          } catch (err) {
            // Simulate rollback on error
            await mockTransaction.rollback();
            throw err;
          }
        });
    });

    it('should successfully transfer funds between wallets', async () => {
      jest
        .spyOn(transactionLogModel, 'create')
        .mockResolvedValue(mockTransactionLog as any);
      jest
        .spyOn(walletModel, 'findByPk')
        .mockResolvedValueOnce(mockFromWallet as any)
        .mockResolvedValueOnce(mockToWallet as any);
      jest.spyOn(walletModel, 'update').mockResolvedValue([1] as any);
      const ledgerCreateSpy = jest
        .spyOn(ledgerEntryModel, 'create')
        .mockResolvedValue({} as any);

      const result = await service.transfer(mockTransferDto);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.fromWallet.newBalance).toBe('900.00');
      expect(result.toWallet.newBalance).toBe('600.00');

      expect(ledgerCreateSpy).toHaveBeenCalledTimes(2);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('should return cached result for duplicate idempotency key', async () => {
      const fixedDate = new Date();
      const cachedResult = {
        success: true,
        transactionId: 'cached-txn-id',
        status: TransactionStatus.COMPLETED,
        fromWallet: { id: 'from-wallet-id', newBalance: '900.00' },
        toWallet: { id: 'to-wallet-id', newBalance: '600.00' },
        timestamp: fixedDate.toISOString(),
      };

      jest
        .spyOn((service as any)['redis'], 'get')
        .mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.transfer(mockTransferDto);

      expect(result).toEqual(cachedResult);
      expect(transactionLogModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for insufficient funds', async () => {
      const insufficientWallet = {
        ...mockFromWallet,
        balance: '50.00',
        hasAvailableBalance: jest.fn().mockReturnValue(false),
      };

      jest
        .spyOn(transactionLogModel, 'create')
        .mockResolvedValue(mockTransactionLog as any);
      jest
        .spyOn(walletModel, 'findByPk')
        .mockResolvedValueOnce(insufficientWallet as any)
        .mockResolvedValueOnce(mockToWallet as any);

      await expect(service.transfer(mockTransferDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when transferring to same wallet', async () => {
      const sameWalletDto = {
        ...mockTransferDto,
        fromWalletId: 'same-wallet-id',
        toWalletId: 'same-wallet-id',
      };

      await expect(service.transfer(sameWalletDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when wallet does not exist', async () => {
      jest
        .spyOn(transactionLogModel, 'create')
        .mockResolvedValue(mockTransactionLog as any);
      jest.spyOn(walletModel, 'findByPk').mockResolvedValue(null);

      await expect(service.transfer(mockTransferDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('should handle race conditions with optimistic locking', async () => {
      jest
        .spyOn(transactionLogModel, 'create')
        .mockResolvedValue(mockTransactionLog as any);
      jest
        .spyOn(walletModel, 'findByPk')
        .mockResolvedValueOnce(mockFromWallet as any)
        .mockResolvedValueOnce(mockToWallet as any);

      // Simulate version conflict (no rows updated)
      jest.spyOn(walletModel, 'update').mockResolvedValue([0] as any);

      await expect(service.transfer(mockTransferDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('should reject negative amounts', async () => {
      const negativeAmountDto = {
        ...mockTransferDto,
        amount: '-100.00',
      };

      await expect(service.transfer(negativeAmountDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject zero amounts', async () => {
      const zeroAmountDto = {
        ...mockTransferDto,
        amount: '0.00',
      };

      await expect(service.transfer(zeroAmountDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle decimal precision correctly', async () => {
      const precisionDto = { ...mockTransferDto, amount: '99.99' };

      jest
        .spyOn(transactionLogModel, 'create')
        .mockResolvedValue(mockTransactionLog as any);
      jest
        .spyOn(walletModel, 'findByPk')
        .mockResolvedValueOnce(mockFromWallet as any)
        .mockResolvedValueOnce(mockToWallet as any);
      jest.spyOn(walletModel, 'update').mockResolvedValue([1] as any);
      jest.spyOn(ledgerEntryModel, 'create').mockResolvedValue({} as any);

      const result = await service.transfer(precisionDto);

      expect(result.fromWallet.newBalance).toBe('900.01');
      expect(result.toWallet.newBalance).toBe('599.99');
    });
  });

  describe('getWallet', () => {
    it('should return wallet by ID', async () => {
      jest
        .spyOn(walletModel, 'findByPk')
        .mockResolvedValue(mockFromWallet as any);
      const result = await service.getWallet('from-wallet-id');
      expect(result).toEqual(mockFromWallet);
    });

    it('should throw NotFoundException when wallet not found', async () => {
      jest.spyOn(walletModel, 'findByPk').mockResolvedValue(null);
      await expect(service.getWallet('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for wallet', async () => {
      const mockTransactions = [mockTransactionLog, mockTransactionLog];
      jest
        .spyOn(transactionLogModel, 'findAll')
        .mockResolvedValue(mockTransactions as any);
      const result = await service.getTransactionHistory('wallet-id');
      expect(result).toEqual(mockTransactions);
    });
  });
});
