import { Body, Controller, Get, Post } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller({ path: 'invites', version: '1' })
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get('me')
  getMine(@CurrentUser('id') userId: string) {
    return this.invitesService.getOrCreateMyInvite(userId);
  }

  @Get('history')
  history(@CurrentUser('id') userId: string) {
    return this.invitesService.listMine(userId);
  }

  @Post('accept')
  accept(@CurrentUser('id') userId: string, @Body() dto: AcceptInviteDto) {
    return this.invitesService.accept(userId, dto.code);
  }
}
