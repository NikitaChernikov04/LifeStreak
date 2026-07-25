import { Module } from '@nestjs/common';
import { HeartsService } from './hearts.service';
import { HeartsController } from './hearts.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [HeartsController],
  providers: [HeartsService],
  exports: [HeartsService],
})
export class HeartsModule {}
