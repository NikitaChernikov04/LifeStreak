import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SocialService } from './social.service';
import { FeedService } from './feed.service';
import { ReactDto, SearchUsersDto, SetSharingDto, UpdatePrivacyDto } from './dto/social.dto';

@Controller({ path: 'social', version: '1' })
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly feed: FeedService,
  ) {}

  // ── privacy ─────────────────────────────────────────────────

  @Get('settings')
  getSettings(@CurrentUser('id') userId: string) {
    return this.social.getSettings(userId);
  }

  @Patch('settings')
  updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdatePrivacyDto) {
    return this.social.updateSettings(userId, dto);
  }

  @Patch('streaks/:id/sharing')
  setSharing(
    @CurrentUser('id') userId: string,
    @Param('id') streakId: string,
    @Body() dto: SetSharingDto,
  ) {
    return this.social.setStreakSharing(userId, streakId, dto.isShared);
  }

  // ── graph ───────────────────────────────────────────────────

  @Get('search')
  search(@CurrentUser('id') userId: string, @Query() dto: SearchUsersDto) {
    return this.social.searchUsers(userId, dto.q);
  }

  @Get('following')
  following(@CurrentUser('id') userId: string) {
    return this.social.listFollowing(userId);
  }

  @Get('followers')
  followers(@CurrentUser('id') userId: string) {
    return this.social.listFollowers(userId);
  }

  @Get('requests')
  requests(@CurrentUser('id') userId: string) {
    return this.social.incomingRequests(userId);
  }

  @Post('requests/:id/accept')
  accept(@CurrentUser('id') userId: string, @Param('id') followId: string) {
    return this.social.respondToRequest(userId, followId, true);
  }

  @Post('requests/:id/decline')
  decline(@CurrentUser('id') userId: string, @Param('id') followId: string) {
    return this.social.respondToRequest(userId, followId, false);
  }

  @Post('follow/:id')
  follow(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.social.follow(userId, targetId);
  }

  @Delete('follow/:id')
  unfollow(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.social.unfollow(userId, targetId);
  }

  @Delete('followers/:id')
  removeFollower(@CurrentUser('id') userId: string, @Param('id') followerId: string) {
    return this.social.removeFollower(userId, followerId);
  }

  // ── feed ────────────────────────────────────────────────────
  // Declared before `users/:id` so "feed" is never read as a user id.

  @Get('feed')
  getFeed(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.feed.feed(userId, query);
  }

  @Post('checkins/:id/reaction')
  react(@CurrentUser('id') userId: string, @Param('id') checkinId: string, @Body() dto: ReactDto) {
    return this.feed.react(userId, checkinId, dto.key);
  }

  @Delete('checkins/:id/reaction')
  unreact(@CurrentUser('id') userId: string, @Param('id') checkinId: string) {
    return this.feed.unreact(userId, checkinId);
  }

  @Get('users/:id')
  profile(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.social.getProfile(userId, targetId);
  }
}
