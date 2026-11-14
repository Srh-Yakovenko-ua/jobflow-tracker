'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ApplicationResponse,
  type FollowupRequest,
  type FollowupRequestInput,
  followupRequestSchema,
  type FollowupResponse,
} from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { Fade } from '@/shared/ui/fade';
import { Reveal } from '@/shared/ui/reveal';

import { forgetDraftEdit, readDraftEdit } from '../lib/draft-edits';
import { type FollowupReady, type FollowupView, followupViewOf } from '../lib/followup-view';
import { useGenerateFollowup } from '../model/use-generate-followup';
import { useMarkFollowupSent } from '../model/use-mark-followup-sent';
import { FollowupEditor } from './followup-editor';
import { FollowupFailure, FollowupFailureAlert } from './followup-failure';
import { FollowupQueued } from './followup-queued';
import { FollowupRequestForm } from './followup-request-form';

export type FollowupPanelProps = Readonly<{
  application: ApplicationResponse;
  followup: Readonly<{ response: FollowupResponse; job: AiJob }>;
}>;

type Ask = Readonly<{ variant: boolean }>;

type PanelControls = ReturnType<typeof usePanelControls>;

function usePanelControls({ application, followup }: FollowupPanelProps) {
  const [manual, setManual] = useState(() => readDraftEdit(application.id)?.key === 'own');
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
      marking.reset();
      generation.generate({ ...request, variant }, () => {
        setManual(false);
        forgetDraftEdit(application.id);
      });
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
      generation.reset();
      setManual(true);
    },
  };
  return { applicationId: application.id, methods, generation, marking, view, actions };
}

function ReadyState({
  controls,
  ready,
}: Readonly<{ controls: PanelControls; ready: FollowupReady }>) {
  const { generation, marking, actions } = controls;
  return (
    <div className="flex flex-col gap-3.5">
      <AnimatePresence initial={false}>
        {ready.failure !== null && (
          <Fade key="failure">
            <FollowupFailureAlert
              failure={{ ...ready.failure, retrying: generation.isPending }}
              actions={{ onRetry: actions.onVariant, onManual: actions.onManual }}
            />
          </Fade>
        )}
      </AnimatePresence>
      <FollowupEditor
        key={ready.key}
        draft={{ ready, applicationId: controls.applicationId }}
        methods={controls.methods}
        actions={{ onVariant: actions.onVariant, onSent: marking.mark }}
        status={{
          generating: generation.isPending,
          marking: marking.isPending,
          sent: marking.isSuccess,
        }}
      />
    </div>
  );
}

const IN_SECTION = { className: 'bg-transparent p-0 shadow-none' };

function PanelState({ controls, job }: Readonly<{ controls: PanelControls; job: AiJob }>) {
  const { view, generation, actions } = controls;
  if (view.kind === 'waiting') {
    return (
      <AsyncState job={job} view={IN_SECTION}>
        <FollowupQueued job={job} />
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
  return <ReadyState controls={controls} ready={view} />;
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
