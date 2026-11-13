import { screen, within } from '@testing-library/react';

import DevUiPage from '@/app/dev/ui/page';
import { uk } from '@/shared/i18n';

import { renderInApp } from './render-in-app';

export function renderGallery() {
  return renderInApp(<DevUiPage />);
}

export async function findLiveToaster() {
  const description = await screen.findByText(uk.devUi.feedback.realToast.description);
  const toaster = description.closest<HTMLElement>('[data-sonner-toaster]');
  if (toaster === null) throw new Error('the live toast is outside the sonner toaster');
  return within(toaster);
}

export function specimenOf(eyebrow: string) {
  const specimen = screen.getByText(eyebrow).parentElement;
  if (specimen === null) throw new Error(`the "${eyebrow}" specimen is missing`);
  return within(specimen);
}

export function sectionTitled(title: string): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section');
  if (section === null) throw new Error(`the "${title}" section is missing`);
  return section;
}
