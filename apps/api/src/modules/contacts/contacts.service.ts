import type {
  Contact,
  ContactListResponse,
  ContactResponse,
  CreateContactInput,
  UpdateContactInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { withIsoTimestamps } from '../../common/iso-timestamps.js';
import { changedOrNotFound, owned } from '../../common/owned.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  type ApplicationHistory,
  type ContactOfApplication,
  type ContactRow,
  type ContactsOfApplication,
  ContactsRepository,
} from './contacts.repository.js';
import { averageResponseHours } from './response-time.js';

const CONTACT_NOT_FOUND = 'Contact not found';

export type CreateContact = ContactsOfApplication & { input: CreateContactInput };

export type EditContact = ContactOfApplication & { input: UpdateContactInput };

type CompanyHistory = { own: ApplicationHistory; histories: ApplicationHistory[] };

const toContact = (row: ContactRow): Contact => withIsoTimestamps(row);

const emailKey = ({ email }: ContactRow) => email?.toLowerCase();

const newestFirst = (left: ContactRow, right: ContactRow) =>
  right.updatedAt.getTime() - left.updatedAt.getTime();

function historiesHolding(contact: ContactRow, { own, histories }: CompanyHistory) {
  const key = emailKey(contact);
  if (key === undefined) {
    return [own];
  }
  return histories.filter(({ contacts }) => contacts.some((other) => emailKey(other) === key));
}

function withResponseTime(company: CompanyHistory) {
  return (contact: ContactRow): ContactResponse => ({
    ...toContact(contact),
    avgResponseHours: averageResponseHours(historiesHolding(contact, company)),
  });
}

function suggestionsFor({ own, histories }: CompanyHistory): Contact[] {
  const taken = new Set(own.contacts.map(emailKey));
  const latest = new Map<string, ContactRow>();
  const others = histories.filter(({ id }) => id !== own.id).flatMap(({ contacts }) => contacts);
  for (const contact of others.sort(newestFirst)) {
    const key = emailKey(contact);
    if (key !== undefined && !taken.has(key) && !latest.has(key)) {
      latest.set(key, contact);
    }
  }
  return [...latest.values()].map(toContact);
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, { applicationId, input }: CreateContact): Promise<Contact> {
    const now = this.clock.now();
    return toContact(owned(await this.repository.insert(userId, { applicationId, input, now })));
  }

  async list(userId: string, applicationId: string): Promise<ContactListResponse> {
    const applicationIds = await this.repository.sameCompanyApplicationIds(userId, {
      applicationId,
    });
    const histories = await this.repository.findHistory(userId, { applicationIds });
    const own = owned(histories.find(({ id }) => id === applicationId) ?? null);
    const company = { own, histories };
    return {
      items: own.contacts.map(withResponseTime(company)),
      suggestions: suggestionsFor(company),
    };
  }

  async update(userId: string, { input, ...contact }: EditContact): Promise<Contact> {
    const updatedAt = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      changedOrNotFound(
        await this.repository.updateOwned(userId, { ...contact, input, updatedAt, tx }),
        CONTACT_NOT_FOUND,
      );
      return owned(await this.repository.findOwned(userId, { ...contact, tx }), CONTACT_NOT_FOUND);
    });
    return toContact(row);
  }

  async remove(userId: string, contact: ContactOfApplication): Promise<void> {
    changedOrNotFound(await this.repository.deleteOwned(userId, contact), CONTACT_NOT_FOUND);
  }
}
