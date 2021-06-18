import { Injectable } from '@nestjs/common';
import { InjectModel, Model } from 'nestjs-dynamoose';
import { Chart, ChartKey } from './chart.interface';

@Injectable()
export class ChartService {
  constructor(
    @InjectModel('chart')
    private chartModel: Model<Chart, ChartKey>,
  ) {}
  // TODO promisify chartModel and handle errors
  create(chart: Chart) {
    return this.chartModel.create(chart);
  }

  batchPut(charts: Array<Chart>) {
    return this.chartModel.batchPut(charts);
  }

  update(chart: Chart) {
    return this.chartModel.update(chart);
  }

  findOne(key: ChartKey) {
    return this.chartModel.get(key);
  }

  // useful for API endpoint
  findMany(address: string, inLast?: 'day') {
    return this.chartModel
      .query('address')
      .eq(address)
      .where('timestamp')
      .ge(Date.now() - 8.64e7) // get results from last day
      .exec();
  }

  findAll() {
    return this.chartModel.scan().exec();
  }
}
