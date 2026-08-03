import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MAX_PROOF_BYTES, PROOF_MIME_TYPES } from './proof-storage.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SocialService } from './social.service';
import { FeedService } from './feed.service';
import { GoalsService } from './goals.service';
import {
  CheckinGoalDto,
  CreateGoalDto,
  ProofsQueryDto,
  ReactDto,
  SearchUsersDto,
  SetSharingDto,
  UpdatePrivacyDto,
} from './dto/social.dto';

@Controller({ path: 'social', version: '1' })
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly feed: FeedService,
    private readonly goals: GoalsService,
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

  // ── friends ─────────────────────────────────────────────────

  @Get('search')
  search(@CurrentUser('id') userId: string, @Query() dto: SearchUsersDto) {
    return this.social.searchUsers(userId, dto.q);
  }

  @Get('friends')
  friends(@CurrentUser('id') userId: string) {
    return this.social.listFriends(userId);
  }

  @Get('leaderboard')
  leaderboard(@CurrentUser('id') userId: string) {
    return this.social.leaderboard(userId);
  }

  @Get('requests')
  requests(@CurrentUser('id') userId: string) {
    return this.social.incomingRequests(userId);
  }

  @Get('requests/outgoing')
  outgoing(@CurrentUser('id') userId: string) {
    return this.social.outgoingRequests(userId);
  }

  @Post('requests/:id/accept')
  accept(@CurrentUser('id') userId: string, @Param('id') friendshipId: string) {
    return this.social.respond(userId, friendshipId, true);
  }

  @Post('requests/:id/decline')
  decline(@CurrentUser('id') userId: string, @Param('id') friendshipId: string) {
    return this.social.respond(userId, friendshipId, false);
  }

  @Post('friends/:id')
  addFriend(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.social.request(userId, targetId);
  }

  /** Cancels a request in either direction, or ends an existing friendship. */
  @Delete('friends/:id')
  removeFriend(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.social.remove(userId, targetId);
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

  // ── group goals ─────────────────────────────────────────────

  @Get('goals')
  listGoals(@CurrentUser('id') userId: string) {
    return this.goals.listMine(userId);
  }

  @Post('goals')
  createGoal(@CurrentUser('id') userId: string, @Body() dto: CreateGoalDto) {
    return this.goals.create(userId, dto);
  }

  @Post('goals/:id/join')
  joinGoal(@CurrentUser('id') userId: string, @Param('id') goalId: string) {
    return this.goals.join(userId, goalId);
  }

  /** Declines an invitation, leaves a goal, or — for the owner — ends it. */
  @Delete('goals/:id')
  leaveGoal(@CurrentUser('id') userId: string, @Param('id') goalId: string) {
    return this.goals.leave(userId, goalId);
  }

  /** The body is optional: evidence is never required to mark a day. */
  @Post('goals/:id/checkin')
  checkinGoal(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @Body() dto: CheckinGoalDto,
  ) {
    return this.goals.checkin(userId, goalId, dto);
  }

  @Post('goals/:id/rescue')
  rescueGoal(@CurrentUser('id') userId: string, @Param('id') goalId: string) {
    return this.goals.rescue(userId, goalId);
  }

  /** Declares the goal done. Any joined member may — see the service comment. */
  @Post('goals/:id/complete')
  completeGoal(@CurrentUser('id') userId: string, @Param('id') goalId: string) {
    return this.goals.complete(userId, goalId);
  }

  /**
   * A photo for today's mark. The browser has already resized and re-encoded
   * it, so the ceiling here is a backstop against a client that did not,
   * rather than the size anything is expected to arrive at.
   */
  @Post('goals/:id/proof')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_PROOF_BYTES, files: 1 } }))
  attachProof(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не пришёл');
    if (!PROOF_MIME_TYPES.includes(file.mimetype as (typeof PROOF_MIME_TYPES)[number])) {
      throw new BadRequestException('Пруф должен быть картинкой');
    }
    return this.goals.attachProof(userId, goalId, file.buffer, file.mimetype);
  }

  /** The days this goal has proofs on — the list the history is browsed by. */
  @Get('goals/:id/proof-days')
  listProofDays(@CurrentUser('id') userId: string, @Param('id') goalId: string) {
    return this.goals.listProofDays(userId, goalId);
  }

  /** Proofs on this goal, optionally narrowed to one day. Members only. */
  @Get('goals/:id/proofs')
  listProofs(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @Query() query: ProofsQueryDto,
  ) {
    return this.goals.listProofs(userId, goalId, query);
  }

  /**
   * The photo itself. Streamed through here rather than served from a URL:
   * the blob store is private, so this handler and its membership check are
   * the only way to the bytes.
   */
  @Get('goals/:id/proofs/:checkinId/image')
  async proofImage(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @Param('checkinId') checkinId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, contentType } = await this.goals.readProof(userId, goalId, checkinId);
    res.set({
      'Content-Type': contentType,
      // Private to one person's browser, and only for as long as one sitting.
      'Cache-Control': 'private, max-age=300',
    });
    return new StreamableFile(stream);
  }

  @Get('users/:id')
  profile(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.social.getProfile(userId, targetId);
  }
}
