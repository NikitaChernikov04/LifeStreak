import { IsHexColor, IsOptional, IsString, Length } from 'class-validator';

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
}
