import { IsHexColor, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateStreakDto {
  @IsString()
  @Length(1, 40)
  title: string;

  @IsString()
  @Length(1, 8)
  icon: string;

  @IsHexColor()
  color: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  /**
   * Days the user already has behind them from a tracker they kept elsewhere.
   * Counted as finished through yesterday, so today stays an open day they
   * record themselves. Capped at ten years — past that it is a typo.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  startingCount?: number;
}
