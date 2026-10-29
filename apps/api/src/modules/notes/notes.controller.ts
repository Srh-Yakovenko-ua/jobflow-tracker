import {
  applicationIdSchema,
  type Note,
  noteIdSchema,
  type NoteInput,
  noteInputSchema,
  type NoteListResponse,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { NotesService } from './notes.service.js';

@Controller('applications')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post(':id/notes')
  create(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Body({ schema: noteInputSchema }) input: NoteInput,
  ): Promise<Note> {
    return this.notes.create(user.id, { applicationId, input });
  }

  @Get(':id/notes')
  list(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
  ): Promise<NoteListResponse> {
    return this.notes.list(user.id, applicationId);
  }

  @Patch(':id/notes/:noteId')
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('noteId', { schema: noteIdSchema }) noteId: string,
    @Body({ schema: noteInputSchema }) input: NoteInput,
  ): Promise<Note> {
    return this.notes.update(user.id, { applicationId, noteId, input });
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('noteId', { schema: noteIdSchema }) noteId: string,
  ): Promise<void> {
    return this.notes.remove(user.id, { applicationId, noteId });
  }
}
