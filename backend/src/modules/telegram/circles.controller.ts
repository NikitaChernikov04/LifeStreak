import { Controller, Delete, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatCircleService } from './chat-circle.service';

/**
 * The app's view of something that lives in Telegram. Joining stays a command
 * in the chat — it is the only place membership can be proved — but seeing
 * where you are counted, and stepping out of it quietly, belong here.
 */
@Controller({ path: 'circles', version: '1' })
export class CirclesController {
  constructor(private readonly circles: ChatCircleService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.circles.listFor(userId);
  }

  @Delete(':id')
  leave(@CurrentUser('id') userId: string, @Param('id') circleId: string) {
    return this.circles.leave(userId, circleId);
  }
}
