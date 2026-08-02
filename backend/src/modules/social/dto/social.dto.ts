import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { REACTION_KEYS, ReactionKey } from '../../../common/enums';

export class UpdatePrivacyDto {
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

export class CreateGoalDto {
  @IsString()
  @Length(1, 40)
  title: string;

  @IsString()
  @Length(1, 8)
  icon: string;

  @IsHexColor()
  color: string;

  /** A week is the shortest span that means anything; a year is the longest
   *  a group can realistically promise each other. */
  @IsInt()
  @Min(3)
  @Max(365)
  targetDays: number;

  /** Friends invited to hold it. The creator is joined automatically. */
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  memberIds: string[];
}
