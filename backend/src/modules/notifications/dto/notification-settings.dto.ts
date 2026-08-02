import { IsBoolean } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  dmEnabled: boolean;
}
