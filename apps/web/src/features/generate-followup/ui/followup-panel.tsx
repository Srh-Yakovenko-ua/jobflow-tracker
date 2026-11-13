'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ApplicationResponse,
  type FollowupRequest,
  type FollowupRequestInput,
  followupRequestSchema,
  type FollowupResponse,
} from '@jobflow/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { Reveal } from '@/shared/ui/reveal';

import { type FollowupView, followupViewOf } from '../lib/followup-view';
import { useGenerateFollowup } from '../model/use-generate-followup';
import { useMarkFollowupSent } from '../model/use-mark-followup-sent';
import { FollowupEditor } from './followup-editor';
import { FollowupFailure } from './followup-failure';
import { FollowupRequestForm } from './followup-request-form';

export type FollowupPanelProps = Readonly<{
  application: ApplicationResponse;
  followup: Readonly<{ response: FollowupResponse; job: AiJob }>;
}>;

type Ask = Readonly<{ variant: boolean }>;

type PanelControls = ReturnType<typeof usePanelControls>;

function usePanelControls({ application, followup }: FollowupPanelProps) {
  const [manual, setManual] = useState(false);
  const methods = useForm<FollowupRequestInput, unknown, FollowupRequest>({
    defaultValues: { tone: 'neutral', language: followup.response.language, hint: '' },
    resolver: zodResolver(followupRequestSchema),
  });
  const generation = useGenerateFollowup({
    applicationId: application.id,
    setError: methods.setError,
  });
  const marking = useMarkFollowupSent(application.id);
  const ask = ({ variant }: Ask) => {
    void methods.handleSubmit((request) => {
      setManual(false);
      marking.reset();
      generation.generate({ ...request, variant });
    })();
  };
  const view = followupViewOf({ response: followup.response, manual, refused: generation.refused });
  const actions = {
    onGenerate: () => {
      ask({ variant: false });
    },
    onVariant: () => {
      ask({ variant: true });
    },
    onManual: () => {
      setManual(true);
    },
  };
  return { methods, generation, marking, view, actions };
}

function PanelState({ controls, job }: Readonly<{ controls: PanelControls; job: AiJob }>) {
  const { view, generation, marking, actions } = controls;
  if (view.kind === 'waiting') {
    return (
      <AsyncState job={job}>
        <p className="text-[13px] leading-normal text-ink-3">{uk.followup.waiting}</p>
      </AsyncState>
    );
  }
  if (view.kind === 'failed') {
    return (
      <FollowupFailure
        methods={controls.methods}
        failure={{ timeout: view.timeout, retrying: generation.isPending }}
        actions={{ onRetry: actions.onGenerate, onManual: actions.onManual }}
      />
    );
  }
  if (view.kind === 'idle') {
    return (
      <FollowupRequestForm
        methods={controls.methods}
        submit={{ pending: generation.isPending, onSubmit: actions.onGenerate }}
      />
    );
  }
  return (
    <FollowupEditor
      key={view.key}
      ready={view}
      actions={{ onVariant: actions.onVariant, onSent: marking.mark }}
      status={{
        generating: generation.isPending,
        marking: marking.isPending,
        sent: marking.isSuccess,
      }}
    />
  );
}

function stateIdOf(view: FollowupView): string {
  return view.kind === 'ready' ? view.key : view.kind;
}

export function FollowupPanel(props: FollowupPanelProps) {
  const controls = usePanelControls(props);
  return (
    <Reveal shown view={{ mode: 'wait', id: stateIdOf(controls.view) }}>
      <PanelState controls={controls} job={props.followup.job} />
    </Reveal>
  );
}
