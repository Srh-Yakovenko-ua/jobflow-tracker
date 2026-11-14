'use client';

import { useId } from 'react';

import { type PushSettingInput, usePushSetting } from '@/features/subscribe-push';
import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Reveal } from '@/shared/ui/reveal';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { SettingSwitch } from './setting-rows';

export type PushSettingRowProps = PushSettingInput;

const COPY = uk.push;

export function PushSettingRow({ settings, save }: PushSettingRowProps) {
  const push = usePushSetting({ settings, save });
  const noteId = useId();
  return (
    <div>
      <SettingSwitch
        copy={uk.settings.notifications.push}
        checked={push.checked}
        onCheckedChange={push.onCheckedChange}
        state={{
          disabled: push.disabled,
          describedBy: push.note === undefined ? undefined : noteId,
        }}
      />
      <Reveal shown={push.note !== undefined} view={{ id: 'push-note' }}>
        <p id={noteId} className="px-5 pb-4 text-[13px] leading-[1.5] text-ink-3">
          {push.note && COPY.notes[push.note]}
        </p>
      </Reveal>
      <Reveal shown={push.checked} view={{ id: 'push-test' }}>
        <div className="px-5 pb-4">
          <Button variant="secondary" className={TOUCH_HEIGHT} onClick={push.onTest}>
            {COPY.test.action}
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
