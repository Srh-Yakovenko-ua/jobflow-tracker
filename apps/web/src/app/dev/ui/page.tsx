import type { Metadata } from 'next';

import { ThemeSwitcher } from '@/features/switch-theme';
import { uk } from '@/shared/i18n';

import { ButtonsSection } from './buttons-section';
import { CardsSection } from './cards-section';
import { ChoiceSection } from './choice-section';
import { EmptyStatesSection } from './empty-states-section';
import { ErrorStatesSection } from './error-states-section';
import { FeedbackSection } from './feedback-section';
import { FieldsSection } from './fields-section';
import { LoadingStatesSection } from './loading-states-section';
import { NavigationSection } from './navigation-section';
import { ScoreSection } from './score-section';
import { SelectsSection } from './selects-section';
import { StagesSection } from './stages-section';

export const metadata: Metadata = { title: uk.devUi.pageTitle, robots: { index: false } };

export default function DevUiPage() {
  return (
    <main className="mx-auto flex max-w-[1296px] flex-col gap-20 px-5 pt-13 pb-32.5 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[27px] leading-[normal] font-medium tracking-[-0.02em]">
          {uk.devUi.pageTitle}
        </h1>
        <ThemeSwitcher />
      </div>
      <EmptyStatesSection />
      <LoadingStatesSection />
      <ErrorStatesSection />
      <ButtonsSection />
      <FieldsSection />
      <SelectsSection />
      <ChoiceSection />
      <NavigationSection />
      <FeedbackSection />
      <ScoreSection />
      <StagesSection />
      <CardsSection />
    </main>
  );
}
