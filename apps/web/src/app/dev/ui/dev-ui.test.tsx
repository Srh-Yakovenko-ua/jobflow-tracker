import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Providers } from '../../providers';
import { LONG_TEXT_CARD } from './card-specimens';
import DevUiPage from './page';

const COPY = uk.devUi;

const CARDS = COPY.cards;

function sourceCombobox() {
  const picker = screen
    .getAllByRole('combobox', { name: COPY.selects.source.label })
    .find((element) => !element.hasAttribute('aria-autocomplete'));
  if (picker === undefined) throw new Error('the #s7 source combobox is missing');
  return picker;
}

function renderGallery() {
  render(
    <Providers theme="light">
      <DevUiPage />
    </Providers>,
  );
  return userEvent.setup();
}

async function findLiveToaster() {
  const description = await screen.findByText(COPY.feedback.realToast.description);
  const toaster = description.closest<HTMLElement>('[data-sonner-toaster]');
  if (toaster === null) throw new Error('the live toast is outside the sonner toaster');
  return within(toaster);
}

async function expectNoAxeViolations() {
  const { violations } = await axe.run(document.body);
  expect(violations).toEqual([]);
}

function specimenOf(eyebrow: string) {
  const specimen = screen.getByText(eyebrow).parentElement;
  if (specimen === null) throw new Error(`the "${eyebrow}" specimen is missing`);
  return within(specimen);
}

describe('/dev/ui gallery', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('has no axe violations as rendered', async () => {
    renderGallery();

    expect(screen.getByRole('heading', { level: 1, name: COPY.pageTitle })).toBeDefined();
    await expectNoAxeViolations();
  });

  it('has no axe violations with the dialog open', async () => {
    const user = renderGallery();

    await user.click(screen.getByRole('button', { name: COPY.feedback.openModal }));
    await screen.findByRole('dialog', { name: COPY.feedback.modal.title });

    await expectNoAxeViolations();
  });

  it('has no axe violations with the source combobox open', async () => {
    const user = renderGallery();

    await user.click(sourceCombobox());
    await screen.findByRole('listbox', { name: COPY.selects.source.label });

    await expectNoAxeViolations();
  });

  it('has no axe violations on the whole page with the CV select open', async () => {
    const user = renderGallery();

    await user.click(screen.getByRole('combobox', { name: COPY.selects.cv.label }));
    await screen.findByRole('listbox', { name: COPY.selects.cv.label });

    await expectNoAxeViolations();
  });

  it('has no axe violations with an action toast shown', async () => {
    const user = renderGallery();

    await user.click(screen.getByRole('button', { name: COPY.feedback.fireToast }));
    await screen.findByText(COPY.feedback.realToast.description);

    await expectNoAxeViolations();
  });

  it('the live toast action closes the toast and the status line names it', async () => {
    const user = renderGallery();

    await user.click(screen.getByRole('button', { name: COPY.feedback.fireToast }));
    const toaster = await findLiveToaster();
    await user.click(toaster.getByRole('button', { name: COPY.feedback.realToast.action }));

    await waitFor(() => {
      expect(screen.queryByText(COPY.feedback.realToast.description)).toBeNull();
    });
    expect(screen.getByText('остання дія: Скасувати').getAttribute('role')).toBe('status');
  });
});

describe('/dev/ui application cards', () => {
  it('a long company is one truncated line titled in full, and the long position wraps whole', () => {
    renderGallery();
    const card = specimenOf(CARDS.long);

    const company = card.getByTitle(LONG_TEXT_CARD.company);
    expect(company.className).toContain('truncate');
    expect(company.textContent).toBe(LONG_TEXT_CARD.company);
    const position = card.getByText(LONG_TEXT_CARD.position);
    expect(position.className).toContain('wrap-anywhere');
    expect(position.className).not.toContain('line-clamp');
  });

  it('the dense card drops the stack tags, the full card shows them with +N', () => {
    renderGallery();

    const compact = specimenOf(CARDS.compact);
    expect(compact.queryByText('React')).toBeNull();
    expect(compact.queryByText('+2')).toBeNull();
    expect(compact.getByText('$5 000–6 500')).toBeDefined();
    const full = specimenOf(CARDS.full);
    expect(full.getByText('React')).toBeDefined();
    expect(full.getByText('TS')).toBeDefined();
    expect(full.getByText('+2')).toBeDefined();
  });

  it('a silent card is dimmed, mutes its score and shows the silence in the source slot', () => {
    renderGallery();
    const silent = specimenOf(CARDS.silent);

    const card = silent.getByRole('article');
    expect(card.className).toContain('bg-surface-2');
    expect(card.className).not.toContain('shadow-e1');
    expect(silent.getByText('9 днів тиші')).toBeDefined();
    expect(silent.queryByText('Djinni')).toBeNull();
    expect(silent.getByRole('img', { name: 'Match Score 58' }).className).toContain(
      'bg-transparent',
    );
  });

  it('cards carry tabular salary, the source, the next event and days in stage against the norm', () => {
    renderGallery();

    const full = specimenOf(CARDS.full);
    expect(full.getByText('$5 000–6 500').className).toContain('tabular-nums');
    expect(full.getByText('Djinni')).toBeDefined();
    expect(specimenOf(CARDS.call).getByText('дзвінок сьогодні, 16:00')).toBeDefined();
    expect(specimenOf(CARDS.norm).getByText('13 днів на етапі · норма 17')).toBeDefined();
    expect(specimenOf(CARDS.long).getByText('вилка не вказана')).toBeDefined();
    expect(specimenOf(CARDS.long).getByRole('img', { name: 'без CV' }).textContent).toBe('—');
  });

  it('the days line shows only next to the user norm', () => {
    renderGallery();

    expect(specimenOf(CARDS.full).queryByText(/на етапі/)).toBeNull();
    expect(specimenOf(CARDS.warn).queryByText(/на етапі/)).toBeNull();
  });

  it('an event tomorrow reads "завтра", and a one-sided salary reads "від" or "до"', () => {
    renderGallery();

    const tomorrow = specimenOf(CARDS.tomorrow);
    expect(tomorrow.getByText("техінтерв'ю завтра, 10:30")).toBeDefined();
    expect(tomorrow.getByText('від $5 200')).toBeDefined();
    expect(specimenOf(CARDS.queued).getByText('до $6 200')).toBeDefined();
  });

  it('a queued, running or failed AI job takes the score slot on the card', () => {
    renderGallery();

    const queued = specimenOf(CARDS.queued);
    expect(queued.getByRole('img', { name: 'Match Score у черзі' })).toBeDefined();
    expect(queued.queryByText('71')).toBeNull();
    expect(
      specimenOf(CARDS.processing).getByRole('img', { name: 'AI рахує Match Score' }),
    ).toBeDefined();
    expect(
      specimenOf(CARDS.failed).getByRole('img', { name: 'Match Score не пораховано' }),
    ).toBeDefined();
  });
});
