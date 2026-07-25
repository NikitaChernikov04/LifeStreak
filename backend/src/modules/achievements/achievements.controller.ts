import { Controller, Get } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller({ path: 'achievements', version: '1' })
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Public()
  @Get()
  findAll() {
    return this.achievementsService.findAll();
  }

  @Get('me')
  findMine(@CurrentUser('id') userId: string) {
    return this.achievementsService.findForUser(userId);
  }
}
