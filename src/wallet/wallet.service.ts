import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  Wallet,
  WalletStatus,
  TransactionLog,
  TransactionStatus,
  TransactionType,
  LedgerEntry,
  LedgerEntryType,
} from './entities';
import { TransferDto, TransferResponseDto } from './dto/transfer.dto';
import { Sequelize } from 'sequelize-typescript';
import { Transaction, Op } from 'sequelize';
import Redis from 'ioredis';
import Decimal from 'decimal.js';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly redis: Redis;
  private readonly IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(TransactionLog)
    private transactionLogModel: typeof TransactionLog,
    @InjectModel(LedgerEntry)
    private ledgerEntryModel: typeof LedgerEntry,
    private sequelize: Sequelize,
  ) {
    // Initialize Redis client
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  /**
   * Main transfer method with idempotency, race condition handling, and double-entry bookkeeping
   */
  async transfer(transferDto: TransferDto): Promise<TransferResponseDto> {
    const {
      idempotencyKey,
      fromWalletId,
      toWalletId,
      amount,
      currency,
      description,
    } = transferDto;

    // Check for idempotency - return cached result if exists
    const cachedResult = await this.checkIdempotency(idempotencyKey);
    if (cachedResult) {
      this.logger.log(`Idempotent request detected: ${idempotencyKey}`);
      return cachedResult;
    }

    // Validate request
    this.validateTransferRequest(transferDto);

    // Acquire distributed lock to prevent concurrent processing of same idempotency key
    const lockAcquired = await this.acquireLock(idempotencyKey);
    if (!lockAcquired) {
      throw new ConflictException(
        'Another request with the same idempotency key is being processed',
      );
    }

    let transactionLog: TransactionLog | null = null;

    try {
      // Create transaction log FIRST (before any financial operations)
      transactionLog = await this.createTransactionLog({
        idempotencyKey,
        fromWalletId,
        toWalletId,
        amount,
        currency: currency || 'NGN',
        description,
        type: TransactionType.TRANSFER,
      });

      // Execute transfer in database transaction
      const result = await this.executeTransfer(transactionLog, transferDto);

      // Cache successful result for idempotency
      await this.cacheResult(idempotencyKey, result);

      return result;
    } catch (error) {
      this.logger.error(`Transfer failed: ${error.message}`, error.stack);

      // Update transaction log to FAILED status (outside the main transaction)
      if (transactionLog) {
        try {
          await transactionLog.update({
            status: TransactionStatus.FAILED,
            errorMessage: error.message,
          });
        } catch (updateError) {
          this.logger.error(
            `Failed to update transaction log status: ${updateError.message}`,
          );
        }
      }

      throw error;
    } finally {
      await this.releaseLock(idempotencyKey);
    }
  }

  /**
   * Execute the actual transfer within a database transaction
   */
  private async executeTransfer(
    transactionLog: TransactionLog,
    transferDto: TransferDto,
  ): Promise<TransferResponseDto> {
    return await this.sequelize.transaction(
      {
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      },
      async (transaction) => {
        try {
          // Update transaction status to PROCESSING
          await transactionLog.update(
            { status: TransactionStatus.PROCESSING },
            { transaction },
          );

          // Lock and fetch wallets with FOR UPDATE to prevent concurrent modifications
          const fromWallet = await this.walletModel.findByPk(
            transferDto.fromWalletId,
            {
              transaction,
              lock: transaction.LOCK.UPDATE,
            },
          );

          if (!fromWallet) {
            throw new NotFoundException('Source wallet not found');
          }

          if (!fromWallet.isActive()) {
            throw new BadRequestException('Source wallet is not active');
          }

          const toWallet = await this.walletModel.findByPk(
            transferDto.toWalletId,
            {
              transaction,
              lock: transaction.LOCK.UPDATE,
            },
          );

          if (!toWallet) {
            throw new NotFoundException('Destination wallet not found');
          }

          if (!toWallet.isActive()) {
            throw new BadRequestException('Destination wallet is not active');
          }

          // Validate sufficient balance
          if (!fromWallet.hasAvailableBalance(transferDto.amount)) {
            throw new BadRequestException({
              error: 'INSUFFICIENT_FUNDS',
              message: 'Wallet balance insufficient for transfer',
              details: {
                available: fromWallet.balance,
                required: transferDto.amount,
              },
            });
          }

          // Validate sufficient balance
          if (!fromWallet.hasAvailableBalance(transferDto.amount)) {
            throw new BadRequestException({
              error: 'INSUFFICIENT_FUNDS',
              message: 'Wallet balance insufficient for transfer',
              details: {
                available: fromWallet.balance,
                required: transferDto.amount,
              },
            });
          }

          // Calculate new balances using Decimal for precision
          const amountDecimal = new Decimal(transferDto.amount);
          const fromBalanceDecimal = new Decimal(fromWallet.balance);
          const toBalanceDecimal = new Decimal(toWallet.balance);

          const newFromBalance = fromBalanceDecimal
            .minus(amountDecimal)
            .toFixed(2);
          const newToBalance = toBalanceDecimal.plus(amountDecimal).toFixed(2);

          // Update balances atomically with version check (optimistic locking)
          const [fromUpdated] = await this.walletModel.update(
            {
              balance: newFromBalance,
              version: fromWallet.version + 1,
            },
            {
              where: {
                id: fromWallet.id,
                version: fromWallet.version,
              },
              transaction,
            },
          );

          const [toUpdated] = await this.walletModel.update(
            {
              balance: newToBalance,
              version: toWallet.version + 1,
            },
            {
              where: {
                id: toWallet.id,
                version: toWallet.version,
              },
              transaction,
            },
          );

          // Check if updates succeeded (version conflict detection)
          if (fromUpdated === 0 || toUpdated === 0) {
            throw new ConflictException(
              'Wallet was modified by another transaction. Please retry.',
            );
          }

          // Create double-entry ledger entries
          await this.createLedgerEntries(
            transactionLog.id,
            fromWallet.id,
            toWallet.id,
            transferDto.amount,
            transferDto.currency || 'NGN',
            newFromBalance,
            newToBalance,
            transferDto.description || '',
            transaction,
          );

          // Mark transaction as completed
          await transactionLog.update(
            {
              status: TransactionStatus.COMPLETED,
              completedAt: new Date(),
            },
            { transaction },
          );

          this.logger.log(
            `Transfer completed successfully: ${transactionLog.id} (${fromWallet.id} -> ${toWallet.id})`,
          );

          return {
            success: true,
            transactionId: transactionLog.id,
            status: TransactionStatus.COMPLETED,
            fromWallet: {
              id: fromWallet.id,
              newBalance: newFromBalance,
            },
            toWallet: {
              id: toWallet.id,
              newBalance: newToBalance,
            },
            timestamp: new Date(),
          };
        } catch (error) {
          this.logger.error(`Transfer execution failed: ${error.message}`);
          throw error;
        }
      },
    );
  }

  /**
   * Create double-entry ledger entries for accounting
   */
  private async createLedgerEntries(
    transactionId: string,
    fromWalletId: string,
    toWalletId: string,
    amount: string,
    currency: string,
    fromBalanceAfter: string,
    toBalanceAfter: string,
    description: string,
    transaction: Transaction,
  ): Promise<void> {
    // Debit entry (money leaving from wallet)
    await this.ledgerEntryModel.create(
      {
        transactionId,
        walletId: fromWalletId,
        type: LedgerEntryType.DEBIT,
        amount,
        currency,
        balanceAfter: fromBalanceAfter,
        description: description || 'Transfer out',
      },
      { transaction },
    );

    // Credit entry (money entering to wallet)
    await this.ledgerEntryModel.create(
      {
        transactionId,
        walletId: toWalletId,
        type: LedgerEntryType.CREDIT,
        amount,
        currency,
        balanceAfter: toBalanceAfter,
        description: description || '',
      },
      { transaction },
    );
  }

  /**
   * Create initial transaction log with PENDING status
   */
  private async createTransactionLog(data: {
    idempotencyKey: string;
    fromWalletId: string;
    toWalletId: string;
    amount: string;
    currency: string;
    description: string | undefined;
    type: TransactionType;
  }): Promise<TransactionLog> {
    try {
      return await this.transactionLogModel.create({
        ...data,
        status: TransactionStatus.PENDING,
      });
    } catch (error) {
      // Handle unique constraint violation on idempotency key
      if (error.name === 'SequelizeUniqueConstraintError') {
        const existing = await this.transactionLogModel.findOne({
          where: { idempotencyKey: data.idempotencyKey },
        });

        if (existing && existing.isCompleted()) {
          // Return cached result
          const cachedResult = await this.getCachedResult(existing);
          if (cachedResult) {
            return existing;
          }
        }

        throw new ConflictException(
          'Transaction with this idempotency key is already being processed',
        );
      }
      throw error;
    }
  }

  /**
   * Validate transfer request parameters
   */
  private validateTransferRequest(transferDto: TransferDto): void {
    if (transferDto.fromWalletId === transferDto.toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    const amount = parseFloat(transferDto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (amount > 1000000000) {
      throw new BadRequestException('Amount exceeds maximum allowed value');
    }
  }

  /**
   * Check if result exists in cache (idempotency check)
   */
  private async checkIdempotency(
    idempotencyKey: string,
  ): Promise<TransferResponseDto | null> {
    const cached = await this.redis.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Also check database for completed transactions
    const transaction = await this.transactionLogModel.findOne({
      where: { idempotencyKey },
    });

    if (transaction && transaction.isCompleted()) {
      return this.getCachedResult(transaction);
    }

    return null;
  }

  /**
   * Build response from transaction log
   */
  private async getCachedResult(
    transaction: TransactionLog,
  ): Promise<TransferResponseDto> {
    const fromWallet = await this.walletModel.findByPk(
      transaction.fromWalletId,
    );
    const toWallet = await this.walletModel.findByPk(transaction.toWalletId);

    if (!fromWallet) {
      throw new NotFoundException('Source wallet not found');
    }

    if (!toWallet) {
      throw new NotFoundException('Destination wallet not found');
    }

    if (!fromWallet.isActive()) {
      throw new BadRequestException('Source wallet is not active');
    }

    if (!toWallet.isActive()) {
      throw new BadRequestException('Destination wallet is not active');
    }

    return {
      success: true,
      transactionId: transaction.id,
      status: transaction.status,
      fromWallet: {
        id: fromWallet.id,
        newBalance: fromWallet.balance,
      },
      toWallet: {
        id: toWallet.id,
        newBalance: toWallet.balance,
      },
      timestamp: transaction.completedAt || transaction.updatedAt,
    };
  }

  /**
   * Cache result in Redis for fast idempotency checks
   */
  private async cacheResult(
    idempotencyKey: string,
    result: TransferResponseDto,
  ): Promise<void> {
    await this.redis.setex(
      `idempotency:${idempotencyKey}`,
      this.IDEMPOTENCY_TTL,
      JSON.stringify(result),
    );
  }

  /**
   * Acquire distributed lock using Redis
   */
  private async acquireLock(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
    return result === 'OK';
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    await this.redis.del(lockKey);
  }

  /**
   * Get all wallets
   */
  async getAllWallets(): Promise<Wallet[]> {
    return await this.walletModel.findAll();
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string): Promise<Wallet> {
    const wallet = await this.walletModel.findByPk(walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  /**
   * Get transaction history for a wallet
   */
  async getTransactionHistory(
    walletId: string,
    limit = 50,
  ): Promise<TransactionLog[]> {
    return await this.transactionLogModel.findAll({
      where: {
        [Op.or]: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}
