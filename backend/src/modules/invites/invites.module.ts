import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { HeartsModule } from '../hearts/hearts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HeartsModule, NotificationsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
