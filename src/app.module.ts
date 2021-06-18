import { Module } from '@nestjs/common';
import { DynamooseModule } from 'nestjs-dynamoose';
import { ChartModule } from './chart/chart.module';
import { ConfigModule } from '@nestjs/config';
import { CollectorModule } from './collector/collector.module';
import { SupplyModule } from './supply/supply.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DynamooseModule.forRoot({
      local: true,
      aws: {
        region: 'us-east-1',
        accessKeyId: 'DEFAULT_ACCESS_KEY',
        secretAccessKey: 'DEFAULT_SECRET',
      },
      model: {
        create: true,
        prefix: 'defi-',
        suffix: '-table',
      },
    }),
    CollectorModule,
    ChartModule,
    SupplyModule,
  ],
})
export class ApplicationModule {}
