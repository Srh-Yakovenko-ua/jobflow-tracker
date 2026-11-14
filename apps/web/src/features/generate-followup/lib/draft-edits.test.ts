import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { DESIGN_FOLLOWUP } from '@/test/followup-fixtures';
import { refuseStorage } from '@/test/refusing-storage';

import { forgetDraftEdit, readDraftEdit, rememberDraftEdit } from './draft-edits';

const ID = ACME_APPLICATION.id;

const EDIT = { key: '2026-11-12T09:00:00.000Z', subject: DESIGN_FOLLOWUP.subject, body: 'Дякую!' };

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('draft edits', () => {
  it('reads back the edit remembered for the application until it is forgotten', () => {
    rememberDraftEdit(ID, EDIT);

    expect(readDraftEdit(ID)).toEqual(EDIT);
    forgetDraftEdit(ID);
    expect(readDraftEdit(ID)).toBeUndefined();
  });

  it('an own draft with only a body written keeps its empty subject', () => {
    rememberDraftEdit(ID, { key: 'own', subject: '', body: 'Дякую' });

    expect(readDraftEdit(ID)).toEqual({ key: 'own', subject: '', body: 'Дякую' });
  });

  it('another application has no edit', () => {
    rememberDraftEdit(ID, EDIT);

    expect(readDraftEdit('0b6f3c1e-5d2a-4c8e-9f10-000000000999')).toBeUndefined();
  });

  it('stored text that is not an edit reads as none', () => {
    sessionStorage.setItem(`jobflow.followup-edit.${ID}`, '{not json');

    expect(readDraftEdit(ID)).toBeUndefined();
  });

  it('a storage that refuses reads as none and neither remembering nor forgetting throws', () => {
    const warned = refuseStorage();

    expect(() => {
      rememberDraftEdit(ID, EDIT);
      forgetDraftEdit(ID);
    }).not.toThrow();
    expect(readDraftEdit(ID)).toBeUndefined();
    expect(warned).toHaveBeenCalledTimes(3);
  });
});
