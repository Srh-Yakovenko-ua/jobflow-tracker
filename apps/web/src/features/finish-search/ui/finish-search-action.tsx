'use client';

import {
  type ApplicationResponse,
  OPEN_APPLICATION_CHOICES,
  type OpenApplicationChoice,
  openApplicationChoiceSchema,
  type SearchSummary,
} from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { activeSearchOf, searchesQueryOptions } from '@/entities/search';
import { uk } from '@/shared/i18n';
import { useLastPresent } from '@/shared/lib/use-last-present';
import { Button } from '@/shared/ui/button';
import { ConfirmFooter } from '@/shared/ui/confirm-footer';
import { Dialog, DialogContent, DialogTrigger } from '@/shared/ui/dialog';
import { RadioGroup } from '@/shared/ui/radio-group';

import { useFinishSearchMutation } from '../model/use-finish-search-mutation';

export type FinishSearchActionProps = Readonly<{ application: ApplicationResponse }>;

const COPY = uk.searches.finish;

const CHOICES = OPEN_APPLICATION_CHOICES.map((value) => ({
  value,
  label: COPY.choice.options[value],
}));

type FinishSearchDialogProps = Readonly<{ search: SearchSummary; onFinished: () => void }>;

function FinishSearchDialog({ search, onFinished }: FinishSearchDialogProps) {
  const mutation = useFinishSearchMutation();
  const [openApplications, setOpenApplications] = useState<OpenApplicationChoice>('withdraw');
  return (
    <DialogContent
      header={{
        eyebrow: <span className="text-offer">{COPY.eyebrow}</span>,
        title: COPY.title,
        description: COPY.hint(search),
      }}
    >
      <RadioGroup
        aria-label={COPY.choice.label}
        options={CHOICES}
        value={openApplications}
        onValueChange={(value) => {
          setOpenApplications(openApplicationChoiceSchema.parse(value));
        }}
      />
      <ConfirmFooter
        copy={COPY}
        action={{
          tone: 'primary',
          pending: mutation.isPending,
          onConfirm: () => {
            mutation.mutate(
              { searchId: search.id, outcome: 'offer_accepted', openApplications },
              { onSuccess: onFinished },
            );
          },
        }}
      />
    </DialogContent>
  );
}

function useFinishableSearch(application: ApplicationResponse): SearchSummary | null {
  const inOffer = application.currentStage === 'offer';
  const searches = useQuery({ ...searchesQueryOptions(), enabled: inOffer });
  const active = activeSearchOf(searches.data?.items ?? []);
  return inOffer && active?.id === application.searchId ? active : null;
}

export function FinishSearchAction({ application }: FinishSearchActionProps) {
  const finishable = useFinishableSearch(application);
  const shown = useLastPresent(finishable);
  const [open, setOpen] = useState(false);
  if (shown === null) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {finishable !== null && (
        <DialogTrigger asChild>
          <Button className="animate-fade-in">{COPY.action}</Button>
        </DialogTrigger>
      )}
      <FinishSearchDialog
        search={shown}
        onFinished={() => {
          setOpen(false);
        }}
      />
    </Dialog>
  );
}
