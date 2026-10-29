import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Providers } from '../../providers';
import DevUiPage from './page';

const COPY = uk.devUi;

function renderGallery() {
  render(
    <Providers theme="light">
      <DevUiPage />
    </Providers>,
  );
  return userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: COPY.selects.source.label }));
    await screen.findByRole('listbox', { name: COPY.selects.source.label });

    await expectNoAxeViolations();
  });

  it('has no axe violations with an action toast shown', async () => {
    const user = renderGallery();

    await user.click(screen.getByRole('button', { name: COPY.feedback.fireToast }));
    await screen.findByText(COPY.feedback.realToast.description);

    await expectNoAxeViolations();
  });
});
