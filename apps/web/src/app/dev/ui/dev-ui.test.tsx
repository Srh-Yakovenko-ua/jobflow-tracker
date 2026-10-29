import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Providers } from '../../providers';
import DevUiPage from './page';

const COPY = uk.devUi;

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
