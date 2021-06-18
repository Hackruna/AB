import { Module } from '@nestjs/common';
import { ChartModule } from 'src/chart/chart.module';
import { CollectorService } from './collector.service';

@Module({
  imports: [ChartModule],
  providers: [CollectorService],
  exports: [],
})
export class CollectorModule {}
