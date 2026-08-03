import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { FeedService } from './feed.service';
import { GoalsService } from './goals.service';
import { ProofStorageService } from './proof-storage.service';
import { SocialController } from './social.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { HeartsModule } from '../hearts/hearts.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, HeartsModule, UsersModule],
  controllers: [SocialController],
  providers: [SocialService, FeedService, GoalsService, ProofStorageService],
  exports: [SocialService],
})
export class SocialModule {}
