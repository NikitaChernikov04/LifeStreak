import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class DemoAuthDto {
  /**
   * The demo entrance key. Length-capped because it is compared against a
   * configured value and there is no reason to accept a megabyte to find out
   * it is wrong.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  secret: string;
}
