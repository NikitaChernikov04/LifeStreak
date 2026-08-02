import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { FeedService } from './feed.service';
import { SocialController } from './social.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SocialController],
  providers: [SocialService, FeedService],
  exports: [SocialService],
})
export class SocialModule {}
