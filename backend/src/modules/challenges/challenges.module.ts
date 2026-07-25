import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { UsersModule } from '../users/users.module';
import { HeartsModule } from '../hearts/hearts.module';

@Module({
  imports: [UsersModule, HeartsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
