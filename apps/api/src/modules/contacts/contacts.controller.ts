import {
  applicationIdSchema,
  type Contact,
  contactIdSchema,
  type ContactListResponse,
  type CreateContactInput,
  createContactInputSchema,
  type UpdateContactInput,
  updateContactInputSchema,
} from '@jobflow/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { type AccessUser, CurrentUser } from '../auth/index.js';
import { ContactsService } from './contacts.service.js';

@Controller('applications')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post(':id/contacts')
  create(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Body({ schema: createContactInputSchema }) input: CreateContactInput,
  ): Promise<Contact> {
    return this.contacts.create(user.id, { applicationId, input });
  }

  @Get(':id/contacts')
  list(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
  ): Promise<ContactListResponse> {
    return this.contacts.list(user.id, applicationId);
  }

  @Patch(':id/contacts/:contactId')
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('contactId', { schema: contactIdSchema }) contactId: string,
    @Body({ schema: updateContactInputSchema }) input: UpdateContactInput,
  ): Promise<Contact> {
    return this.contacts.update(user.id, { applicationId, contactId, input });
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AccessUser,
    @Param('id', { schema: applicationIdSchema }) applicationId: string,
    @Param('contactId', { schema: contactIdSchema }) contactId: string,
  ): Promise<void> {
    return this.contacts.remove(user.id, { applicationId, contactId });
  }
}
