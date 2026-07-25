import { Controller, Get, Param, Post } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller({ path: 'challenges', version: '1' })
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('today')
  getToday(@CurrentUser('id') userId: string) {
    return this.challengesService.getTodayChallenge(userId);
  }

  @Post(':id/complete')
  complete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.challengesService.complete(userId, id);
  }
}
