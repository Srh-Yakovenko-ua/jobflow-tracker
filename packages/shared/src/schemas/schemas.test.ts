import { describe, expect, it } from 'vitest';

import { applicationSchema } from './application.js';
import { contactSchema } from './contact.js';
import { errorResponseSchema } from './error-response.js';
import { noteSchema } from './note.js';
import { paginatedSchema, paginationQuerySchema } from './pagination.js';
import { resumeVersionSchema } from './resume-version.js';
import { stageEventSchema } from './stage-event.js';
import { userSettingsSchema } from './user-settings.js';

const application = {
  id: '01920000-0000-7000-8000-000000000001',
  searchId: '01920000-0000-7000-8000-000000000002',
  company: 'Grammarly',
  position: 'Backend Engineer',
  url: 'https://jobs.dou.ua/companies/grammarly/vacancies/1/',
  source: 'dou',
  salaryMin: 3000,
  salaryMax: 4500,
  currency: 'USD',
  stack: ['Node.js', 'PostgreSQL'],
  location: 'Київ',
  workMode: 'hybrid',
  currentStage: 'tech_interview',
  isDraft: false,
  resumeVersionId: null,
  matchScore: 78,
  aiParsed: null,
  rawText: null,
  appliedAt: '2026-10-01T09:00:00Z',
  lastEventAt: '2026-10-10T12:30:00Z',
  createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-10T12:30:00Z',
};

describe('errorResponseSchema', () => {
  it('accepts the DOC-04 validation error example', () => {
    const result = errorResponseSchema.safeParse({
      type: 'validation_error',
      title: 'Invalid request',
      status: 422,
      detail: 'salaryMin must not be negative',
      errors: [{ path: 'salaryMin', message: 'Too small' }],
      requestId: 'req-1',
    });
    expect(result.success).toBe(true);
  });

  it('refuses an error without a requestId', () => {
    expect(
      errorResponseSchema.safeParse({ type: 'not_found', title: 'Not found', status: 404 }).success,
    ).toBe(false);
  });
});

describe('paginationQuerySchema', () => {
  it('defaults the limit to 50', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 50 });
  });

  it('reads a limit given as a query string', () => {
    expect(paginationQuerySchema.parse({ limit: '20', cursor: 'abc' })).toEqual({
      limit: 20,
      cursor: 'abc',
    });
  });

  it('refuses a limit of 101', () => {
    expect(paginationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('paginatedSchema', () => {
  it('wraps items with a nullable next cursor', () => {
    const page = paginatedSchema(applicationSchema).parse({
      items: [application],
      nextCursor: null,
    });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });
});

describe('applicationSchema', () => {
  it('accepts an application in the API representation', () => {
    expect(applicationSchema.safeParse(application).success).toBe(true);
  });

  it('refuses a match score of 101', () => {
    expect(applicationSchema.safeParse({ ...application, matchScore: 101 }).success).toBe(false);
  });

  it('refuses an unknown stage', () => {
    expect(applicationSchema.safeParse({ ...application, currentStage: 'hired' }).success).toBe(
      false,
    );
  });

  it('refuses a fractional salary', () => {
    expect(applicationSchema.safeParse({ ...application, salaryMin: 3000.5 }).success).toBe(false);
  });
});

const timestamps = { createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z' };

describe('stageEventSchema', () => {
  const event = {
    id: '01920000-0000-7000-8000-000000000010',
    applicationId: application.id,
    fromStage: null,
    toStage: 'applied',
    reasonCode: null,
    comment: null,
    occurredAt: '2026-10-01T09:00:00Z',
    compensatesEventId: null,
    createdAt: '2026-10-01T09:00:00Z',
  };

  it('accepts the first event of an application without a from stage', () => {
    expect(stageEventSchema.safeParse(event).success).toBe(true);
  });

  it('refuses a reason code outside the taxonomy', () => {
    expect(stageEventSchema.safeParse({ ...event, reasonCode: 'bad_vibes' }).success).toBe(false);
  });
});

describe('contactSchema', () => {
  const contact = {
    id: '01920000-0000-7000-8000-000000000020',
    applicationId: application.id,
    name: 'Олена',
    role: 'Recruiter',
    email: 'olena@example.com',
    telegram: null,
    phone: null,
    note: null,
    ...timestamps,
  };

  it('accepts a contact with only a name and an email', () => {
    expect(contactSchema.safeParse(contact).success).toBe(true);
  });

  it('refuses a malformed email', () => {
    expect(contactSchema.safeParse({ ...contact, email: 'olena' }).success).toBe(false);
  });
});

describe('noteSchema', () => {
  it('refuses an empty body', () => {
    const note = {
      id: '01920000-0000-7000-8000-000000000030',
      applicationId: application.id,
      body: '',
      ...timestamps,
    };
    expect(noteSchema.safeParse(note).success).toBe(false);
  });
});

describe('resumeVersionSchema', () => {
  it('refuses a fractional file size', () => {
    const resumeVersion = {
      id: '01920000-0000-7000-8000-000000000040',
      resumeId: '01920000-0000-7000-8000-000000000041',
      filename: 'cv.pdf',
      mime: 'application/pdf',
      sizeBytes: 1024.5,
      title: 'Backend',
      note: null,
      aiProfile: null,
      isArchived: false,
      uploadedAt: '2026-10-01T09:00:00Z',
      ...timestamps,
    };
    expect(resumeVersionSchema.safeParse(resumeVersion).success).toBe(false);
  });
});

describe('userSettingsSchema', () => {
  const settings = {
    silenceDays: 7,
    autoGhostDays: 30,
    askRejectionReason: true,
    monthlySummaryEnabled: true,
    theme: 'system',
    timezone: 'Europe/Kyiv',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    notifyInApp: true,
    notifyPush: false,
    notifyEmail: true,
    analyticsOptOut: false,
    activeResumeVersionId: null,
  };

  it('accepts the settings a new user starts with', () => {
    expect(userSettingsSchema.parse(settings)).toEqual(settings);
  });

  it('refuses quiet hours starting at 24:00', () => {
    expect(userSettingsSchema.safeParse({ ...settings, quietHoursStart: '24:00' }).success).toBe(
      false,
    );
  });

  it('refuses quiet hours with seconds', () => {
    expect(userSettingsSchema.safeParse({ ...settings, quietHoursEnd: '08:00:00' }).success).toBe(
      false,
    );
  });
});
