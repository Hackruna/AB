import { Controller, Get, Param } from '@nestjs/common';
import { SupplyService } from './supply.service';
import { Supply } from './supply.interface';

@Controller('supply')
export class SupplyController {
  constructor(private readonly supplyService: SupplyService) {}

  @Get(':address')
  async find(@Param() params): Promise<Supply[]> {
    return await this.supplyService.find(params.address);
  }
}
