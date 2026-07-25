import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string;
}
