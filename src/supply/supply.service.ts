import { Injectable } from '@nestjs/common';
import { Supply } from './supply.interface';
import { ChartService } from '../chart/chart.service';

@Injectable()
export class SupplyService {
  constructor(private readonly chartService: ChartService) {}

  async find(address: string): Promise<Supply[]> {
    const charts = await this.chartService.findMany(address);
    charts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return charts.map((chart) => ({
      totalSupply: chart.value,
      timestamp: chart.timestamp.getTime(),
    }));
  }
}
