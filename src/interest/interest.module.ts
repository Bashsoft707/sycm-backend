import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InterestController } from './interest.controller';
import { InterestService } from './interest.service';
import { InterestRecord } from './entities/interest.entity';

@Module({
  imports: [SequelizeModule.forFeature([InterestRecord])],
  controllers: [InterestController],
  providers: [InterestService],
  exports: [InterestService],
})
export class InterestModule {}
