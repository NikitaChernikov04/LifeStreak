import { Module } from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { StreaksController } from './streaks.controller';
import { UsersModule } from '../users/users.module';
import { HeartsModule } from '../hearts/hearts.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [UsersModule, HeartsModule, AchievementsModule],
  controllers: [StreaksController],
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
