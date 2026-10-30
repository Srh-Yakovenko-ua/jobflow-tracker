import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';

import DevUiPage from '@/app/dev/ui/page';
import { Providers } from '@/app/providers';
import { uk } from '@/shared/i18n';

export function renderGallery() {
  render(
    <Providers theme="light">
      <DevUiPage />
    </Providers>,
  );
  return userEvent.setup();
}

export async function findLiveToaster() {
  const description = await screen.findByText(uk.devUi.feedback.realToast.description);
  const toaster = description.closest<HTMLElement>('[data-sonner-toaster]');
  if (toaster === null) throw new Error('the live toast is outside the sonner toaster');
  return within(toaster);
}

export async function axeViolations() {
  const { violations } = await axe.run(document.body);
  return violations;
}

export function specimenOf(eyebrow: string) {
  const specimen = screen.getByText(eyebrow).parentElement;
  if (specimen === null) throw new Error(`the "${eyebrow}" specimen is missing`);
  return within(specimen);
}
