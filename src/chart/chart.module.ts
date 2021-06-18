import { DynamooseModule } from 'nestjs-dynamoose';
import { ChartSchema } from './chart.schema';
import { ChartService } from './chart.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    DynamooseModule.forFeature([{ name: 'chart', schema: ChartSchema }]),
  ],
  providers: [ChartService],
  exports: [ChartService],
})
export class ChartModule {}
