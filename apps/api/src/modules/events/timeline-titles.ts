import {
  type CaptureMethod,
  SCHEDULED_EVENT_KIND_LABELS,
  type Stage,
  STAGE_LABELS,
  type TimelineRecord,
} from '@jobflow/shared';

type PayloadOf = { [Entry in TimelineRecord as Entry['kind']]: Entry['payload'] };

type RecordOf<Kind extends keyof PayloadOf> = { kind: Kind; payload: PayloadOf[Kind] };

type RecordTitles = { [Kind in keyof PayloadOf]: (payload: PayloadOf[Kind]) => string };

export type StageChange = { fromStage: Stage | null; toStage: Stage };

export const NOTE_TITLE = 'Заметка';

const CAPTURE_TITLES: Record<CaptureMethod, string> = {
  bookmarklet: 'Карточку створено букмарклетом',
  paste: 'Карточку створено з тексту',
};

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const UKRAINIAN_PLURALS = new Intl.PluralRules('uk');

const SECONDS: PluralForms = { one: 'секунду', few: 'секунди', other: 'секунд' };

const DAYS: PluralForms = { one: 'день', few: 'дні', other: 'днів' };

function counted(count: number, forms: PluralForms): string {
  return `${String(count)} ${forms[UKRAINIAN_PLURALS.select(count)] ?? forms.other}`;
}

const RECORD_TITLES: RecordTitles = {
  captured: ({ method }) => CAPTURE_TITLES[method],
  ai_parsed: ({ durationSec }) => `AI розібрав опис за ${counted(durationSec, SECONDS)}`,
  silence_started: ({ silenceDays }) => `${counted(silenceDays, DAYS)} тиші · індикатор увімкнено`,
  followup_generated: () => 'Фоллоу-ап згенеровано',
  followup_sent: () => 'Фоллоу-ап надіслано',
  interview_scheduled: ({ kind }) => `${SCHEDULED_EVENT_KIND_LABELS[kind].labelUk} заплановано`,
  interview_done: ({ kind, durationMin }) =>
    `${SCHEDULED_EVENT_KIND_LABELS[kind].labelUk} пройдено · ${String(durationMin)} хв`,
  note_added: () => NOTE_TITLE,
  resume_attached: () => 'CV прикріплено',
};

export function recordTitle<Kind extends keyof PayloadOf>({
  kind,
  payload,
}: RecordOf<Kind>): string {
  return RECORD_TITLES[kind](payload);
}

export function stageChangeTitle({ fromStage, toStage }: StageChange): string {
  const to = STAGE_LABELS[toStage].labelUk;
  return fromStage === null ? `${to} надіслано` : `${STAGE_LABELS[fromStage].labelUk} → ${to}`;
}
