import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { CreateStreakDto } from './dto/create-streak.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller({ path: 'streaks', version: '1' })
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Public()
  @Get('templates')
  getTemplates() {
    return this.streaksService.getTemplates();
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.streaksService.findAllForUser(userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateStreakDto) {
    return this.streaksService.create(userId, dto);
  }

  @Delete(':id')
  archive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.streaksService.archive(userId, id);
  }

  @Post(':id/checkin')
  checkin(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.streaksService.checkin(userId, id);
  }

  @Post(':id/recover')
  recover(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.streaksService.recover(userId, id);
  }
}
