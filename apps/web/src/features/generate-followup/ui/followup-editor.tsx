'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { DONE_DOT } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { copyToClipboard } from '@/shared/ui/copy-button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { Textarea } from '@/shared/ui/textarea';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { FollowupReady } from '../lib/followup-view';

export type FollowupEditorProps = Readonly<{
  ready: FollowupReady;
  actions: Readonly<{ onVariant: () => void; onSent: () => void }>;
  status: Readonly<{ generating: boolean; marking: boolean; sent: boolean }>;
}>;

const COPY = uk.followup;

const ACTION = cn('h-9', TOUCH_HEIGHT);

function letterOf(subject: string, body: string): string {
  return [subject, body].filter((part) => part.trim() !== '').join('\n\n');
}

export function FollowupEditor({ ready, actions, status }: FollowupEditorProps) {
  const [subject, setSubject] = useState(ready.draft.subject);
  const [body, setBody] = useState(ready.draft.body);
  const empty = body.trim() === '';
  return (
    <div className="flex flex-col gap-3">
      <p className={cn('flex items-center gap-2.25 font-ui text-offer', STATE_TEXT.eyebrow)}>
        {!ready.own && DONE_DOT}
        {ready.own ? COPY.own : COPY.ready}
      </p>
      <Field label={COPY.subject}>
        <Input
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
          }}
        />
      </Field>
      <Field label={COPY.body}>
        <Textarea
          rows={9}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
          }}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          className={ACTION}
          disabled={empty}
          onClick={() => {
            copyToClipboard(letterOf(subject, body));
          }}
        >
          {COPY.copy}
        </Button>
        <Button
          variant="outline"
          className={ACTION}
          loading={status.generating}
          onClick={actions.onVariant}
        >
          {COPY.variant}
        </Button>
        <Button
          variant="ghost"
          className={ACTION}
          loading={status.marking}
          disabled={status.sent || empty}
          onClick={actions.onSent}
        >
          {COPY.markSent}
        </Button>
      </div>
    </div>
  );
}
