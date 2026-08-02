import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PROFILE_VISIBILITIES, REACTION_KEYS, ProfileVisibility, ReactionKey } from '../../../common/enums';

export class UpdatePrivacyDto {
  @IsOptional()
  @IsIn(PROFILE_VISIBILITIES)
  profileVisibility?: ProfileVisibility;

  @IsOptional()
  @IsBoolean()
  isDiscoverable?: boolean;
}

export class SearchUsersDto {
  /** Matched against @username and first name. Short queries would return
   *  half the table, so two characters is the floor. */
  @IsString()
  @Length(2, 32)
  q: string;
}

export class ReactDto {
  @IsIn(REACTION_KEYS)
  key: ReactionKey;
}

export class SetSharingDto {
  @IsBoolean()
  @Type(() => Boolean)
  isShared: boolean;
}
