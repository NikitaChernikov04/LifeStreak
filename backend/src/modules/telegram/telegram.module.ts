import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ChatCircleService } from './chat-circle.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { CirclesController } from './circles.controller';

@Module({
  controllers: [TelegramWebhookController, CirclesController],
  providers: [TelegramService, ChatCircleService],
  exports: [TelegramService, ChatCircleService],
})
export class TelegramModule {}
