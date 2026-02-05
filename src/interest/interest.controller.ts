import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InterestService } from './interest.service';
import {
  CalculateDailyInterestDto,
  InterestCalculationResponseDto,
  BatchCalculateInterestDto,
  BatchInterestResponseDto,
} from './dto/interest.dto';
import { InterestRecord } from './entities/interest.entity';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Interest')
@Controller('interest')
export class InterestController {
  private readonly logger = new Logger(InterestController.name);

  constructor(private readonly interestService: InterestService) {}

  /**
   * POST /interest/calculate-daily
   * Calculate daily interest for a given principal and date
   */
  @ApiOperation({ summary: 'Calculate daily interest' })
  @ApiBody({ type: CalculateDailyInterestDto })
  @ApiOkResponse({ type: InterestCalculationResponseDto })
  @Post('calculate-daily')
  @HttpCode(HttpStatus.OK)
  async calculateDailyInterest(
    @Body() dto: CalculateDailyInterestDto,
  ): Promise<InterestCalculationResponseDto> {
    this.logger.log(
      `Daily interest calculation request: ${dto.principalAmount} at ${dto.annualRate}% for ${dto.calculationDate}`,
    );

    const result = await this.interestService.calculateDailyInterest(dto);

    this.logger.log(`Interest calculated: ${result.interestAmount}`);
    return result;
  }

  /**
   * POST /interest/calculate-batch
   * Calculate interest for a date range
   */
  @ApiOperation({ summary: 'Calculate interest over a date range' })
  @ApiBody({ type: BatchCalculateInterestDto })
  @ApiOkResponse({ type: BatchInterestResponseDto })
  @Post('calculate-batch')
  @HttpCode(HttpStatus.OK)
  async calculateBatchInterest(
    @Body() dto: BatchCalculateInterestDto,
  ): Promise<BatchInterestResponseDto> {
    this.logger.log(
      `Batch interest calculation: ${dto.startDate} to ${dto.endDate}`,
    );

    const result = await this.interestService.calculateBatchInterest(dto);

    this.logger.log(
      `Batch calculation completed: ${result.numberOfDays} days, total: ${result.totalInterest}`,
    );
    return result;
  }

  /**
   * GET /interest/history/:accountId
   * Get interest calculation history for an account
   */
  @ApiOperation({ summary: 'Get interest calculation history' })
  @ApiParam({ name: 'accountId' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({
    schema: {
      properties: {
        records: {
          type: 'array',
          items: { $ref: '#/components/schemas/InterestRecord' },
        },
      },
    },
  })
  @Get('history/:accountId')
  async getHistory(
    @Param('accountId') accountId: string,
    @Query('limit') limit?: number,
  ): Promise<{ records: InterestRecord[] }> {
    const records = await this.interestService.getInterestHistory(
      accountId,
      limit || 30,
    );
    return { records };
  }

  /**
   * GET /interest/total/:accountId
   * Get total interest for an account in a date range
   */
  @ApiOperation({ summary: 'Get total interest for an account' })
  @ApiParam({ name: 'accountId' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiOkResponse({
    schema: {
      properties: {
        totalInterest: { type: 'string' },
        recordCount: { type: 'number' },
      },
    },
  })
  @Get('total/:accountId')
  async getTotalInterest(
    @Param('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ totalInterest: string; recordCount: number }> {
    return await this.interestService.getTotalInterest(
      accountId,
      startDate,
      endDate,
    );
  }
}
