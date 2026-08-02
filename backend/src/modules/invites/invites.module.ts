import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { HeartsModule } from '../hearts/hearts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [HeartsModule, NotificationsModule, TelegramModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
