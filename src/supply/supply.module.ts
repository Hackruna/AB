import { Module } from '@nestjs/common';
import { ChartModule } from 'src/chart/chart.module';
import { SupplyService } from './supply.service';
import { SupplyController } from './supply.controller';

@Module({
  imports: [ChartModule],
  providers: [SupplyService],
  controllers: [SupplyController],
  exports: [],
})
export class SupplyModule {}
