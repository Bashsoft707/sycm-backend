import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { TransferDto, TransferResponseDto } from './dto/transfer.dto';
import { Wallet } from './entities/wallet.entity';
import { TransactionLog } from './entities/transaction-log.entity';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(private readonly walletService: WalletService) {}

  /**
   * POST /wallet/transfer
   * Execute a transfer between wallets with idempotency support
   */
  @ApiOperation({ summary: 'Transfer funds between wallets' })
  @ApiBody({ type: TransferDto })
  @ApiOkResponse({
    description: 'Transfer successful',
    type: TransferResponseDto,
  })
  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  async transfer(
    @Body() transferDto: TransferDto,
  ): Promise<TransferResponseDto> {
    this.logger.log(`Transfer request received: ${transferDto.idempotencyKey}`);

    try {
      const result = await this.walletService.transfer(transferDto);
      this.logger.log(`Transfer successful: ${result.transactionId}`);
      return result;
    } catch (error) {
      this.logger.error(`Transfer failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * GET /wallet
   * Get all wallets
   */
  @ApiOperation({ summary: 'Get all wallets' })
  @ApiOkResponse({ type: Wallet, isArray: true })
  @Get()
  async getAllWallets(): Promise<Wallet[]> {
    return await this.walletService.getAllWallets();
  }

  /**
   * GET /wallet/:id
   * Get wallet details by ID
   */
  @ApiOperation({ summary: 'Get wallet by ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID (UUID)' })
  @ApiOkResponse({ type: Wallet })
  @Get(':id')
  async getWallet(@Param('id') walletId: string): Promise<Wallet> {
    return await this.walletService.getWallet(walletId);
  }

  /**
   * GET /wallet/:id/history
   * Get transaction history for a wallet
   */
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiParam({ name: 'id', description: 'Wallet ID (UUID)' })
  @ApiOkResponse({
    schema: {
      properties: {
        transactions: {
          type: 'array',
          items: { $ref: '#/components/schemas/TransactionLog' },
        },
      },
    },
  })
  @Get(':id/history')
  async getHistory(
    @Param('id') walletId: string,
  ): Promise<{ transactions: TransactionLog[] }> {
    const transactions =
      await this.walletService.getTransactionHistory(walletId);
    return { transactions };
  }
}
