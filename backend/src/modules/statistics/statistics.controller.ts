import { Controller, Get } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller({ path: 'statistics', version: '1' })
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('me')
  getMine(@CurrentUser('id') userId: string) {
    return this.statisticsService.getForUser(userId);
  }
}
