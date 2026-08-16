import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { GOAL_MODES, GoalMode, REACTION_KEYS, ReactionKey } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

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

  @IsOptional()
  @IsIn(GOAL_MODES)
  mode?: GoalMode;

  /**
   * TOGETHER only, and required there. A competition's length is not given in
   * days but as a count of sprints, so that it can never leave a remainder —
   * a final sprint two days long would be a different game from the rest.
   *
   * A week is the shortest span that means anything; a year is the longest a
   * group can realistically promise each other.
   */
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(365)
  targetDays?: number;

  /** VERSUS only. Short enough to restart often, long enough that one bad day
   *  is not the whole verdict. */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(14)
  sprintDays?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(60)
  sprintCount?: number;

  /** Friends invited to hold it. The creator is joined automatically. */
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  memberIds: string[];
}

export class ProofsQueryDto extends PaginationQueryDto {
  /** One UTC day, when the history is being read a day at a time. */
  @IsOptional()
  @IsISO8601()
  date?: string;
}

/**
 * Evidence is optional on every mark and never required by anything. See the
 * comment on GroupGoalCheckin.proofNote for why it is not a gate.
 */
export class CheckinGoalDto {
  @IsOptional()
  @IsString()
  @Length(1, 280)
  proofNote?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @Length(1, 500)
  proofUrl?: string;
}

/**
 * Editing the proof on a day already marked.
 *
 * Note and link allow an empty string, which the checkin DTO does not: there
 * the fields are only ever being written for the first time, and an empty one
 * means "not given". Here the form arrives carrying what is already saved, so
 * an empty field is a person deleting what they wrote, and refusing it would
 * make a note impossible to take back.
 *
 * Arrives as multipart alongside an optional file, so every value is a string.
 */
export class AttachProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  proofNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf((_, value) => value !== '')
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  proofUrl?: string;
}
