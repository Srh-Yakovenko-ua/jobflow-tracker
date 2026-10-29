import {
  type SettingsSuggestions,
  type UpdateUserSettingsInput,
  updateUserSettingsInputSchema,
  type UserSettings,
} from '@jobflow/shared';
import { Body, Controller, Get, Patch } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AccessUser): Promise<UserSettings> {
    return this.settings.get(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AccessUser,
    @Body({ schema: updateUserSettingsInputSchema }) input: UpdateUserSettingsInput,
  ): Promise<UserSettings> {
    return this.settings.update(user.id, input);
  }

  @Get('suggestions')
  suggestions(@CurrentUser() user: AccessUser): Promise<SettingsSuggestions> {
    return this.settings.suggestions(user.id);
  }
}
