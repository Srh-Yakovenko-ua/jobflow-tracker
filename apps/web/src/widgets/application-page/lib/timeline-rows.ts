import {
  type ApplicationResponse,
  isActiveStage,
  REJECTION_REASONS,
  rejectionReasonCodeSchema,
  type ScheduledEventKind,
  scheduledEventKindSchema,
  SOURCE_LABELS,
  type Stage,
  stageSchema,
  type TimelineItem,
  type TimelineItemType,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type TimelineMarker =
  { kind: 'stage'; stage: Stage } | { kind: 'ring' } | { kind: 'silence' };

export type TimelineTone = 'muted' | 'medium' | 'strong';

export type TimelineRow = {
  id: TimelineItem['id'];
  at: Date;
  title: string;
  meta: string | null;
  marker: TimelineMarker;
  tone: TimelineTone;
};

export type TimelineRowsInput = {
  items: readonly TimelineItem[];
  application: ApplicationResponse;
};

type Meta = TimelineItem['meta'];

type MetaValue = Meta[string] | undefined;

type MetaContext = {
  meta: Meta;
  application: ApplicationResponse;
  parsed: TimelineItem | undefined;
};

type RowLook = {
  marker: (meta: Meta) => TimelineMarker;
  tone: TimelineTone;
  meta: (context: MetaContext) => string | null;
};

const COPY = uk.timeline;

const RING: TimelineMarker = { kind: 'ring' };

const INTERVIEW_STAGES: Record<ScheduledEventKind, Stage | null> = {
  screening_call: 'screening',
  tech_interview: 'tech_interview',
  final_interview: 'final',
  offer_call: 'offer',
  other: null,
};

const ringed = () => RING;

const noMeta = () => null;

function stageOf(value: MetaValue): Stage | null {
  const parsed = stageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function textOf(value: MetaValue): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function markerOf(stage: Stage | null): TimelineMarker {
  return stage === null ? RING : { kind: 'stage', stage };
}

function stageMoveMarker(meta: Meta): TimelineMarker {
  const toStage = stageOf(meta.toStage);
  if (toStage === null || !isActiveStage(toStage)) {
    return markerOf(toStage);
  }
  return markerOf(stageOf(meta.fromStage) ?? toStage);
}

function interviewMarker(meta: Meta): TimelineMarker {
  const kind = scheduledEventKindSchema.safeParse(meta.kind);
  return markerOf(kind.success ? INTERVIEW_STAGES[kind.data] : null);
}

function daysInStageOf(meta: Meta): string | null {
  const fromStage = stageOf(meta.fromStage);
  const days = meta.daysInPreviousStage;
  if (fromStage === null || typeof days !== 'number') {
    return null;
  }
  return COPY.daysInStage(days, COPY.stageGenitive[fromStage]);
}

function reasonOf(meta: Meta): string | null {
  const code = rejectionReasonCodeSchema.safeParse(meta.reasonCode);
  return code.success ? COPY.reason(REJECTION_REASONS[code.data].labelUk) : null;
}

function stageMoveMeta({ meta, application }: MetaContext): string {
  if (meta.fromStage === null) {
    return COPY.via(SOURCE_LABELS[application.source].labelUk);
  }
  const parts = [COPY.movedByHand, daysInStageOf(meta), reasonOf(meta), textOf(meta.comment)];
  return parts.filter((part) => part !== null).join(' ');
}

const LOOKS: Record<TimelineItemType, RowLook> = {
  stage_changed: { marker: stageMoveMarker, tone: 'strong', meta: stageMoveMeta },
  captured: { marker: ringed, tone: 'medium', meta: ({ parsed }) => parsed?.title ?? null },
  ai_parsed: { marker: ringed, tone: 'muted', meta: noMeta },
  silence_started: {
    marker: () => ({ kind: 'silence' }),
    tone: 'muted',
    meta: () => COPY.silenceMeta,
  },
  followup_generated: { marker: ringed, tone: 'muted', meta: noMeta },
  followup_sent: { marker: ringed, tone: 'strong', meta: noMeta },
  interview_scheduled: { marker: ringed, tone: 'strong', meta: noMeta },
  interview_done: { marker: interviewMarker, tone: 'strong', meta: noMeta },
  note_added: { marker: ringed, tone: 'strong', meta: ({ meta }) => textOf(meta.body) },
  resume_attached: { marker: ringed, tone: 'strong', meta: noMeta },
};

function foldedParseOf(items: readonly TimelineItem[]): TimelineItem | undefined {
  if (!items.some((item) => item.type === 'captured')) {
    return undefined;
  }
  return items.filter((item) => item.type === 'ai_parsed').at(-1);
}

export function timelineRowsOf({ items, application }: TimelineRowsInput): TimelineRow[] {
  const parsed = foldedParseOf(items);
  return items
    .filter((item) => item !== parsed)
    .map(({ id, type, occurredAt, title, meta }) => {
      const look = LOOKS[type];
      return {
        id,
        at: new Date(occurredAt),
        title,
        meta: look.meta({ meta, application, parsed }),
        marker: look.marker(meta),
        tone: look.tone,
      };
    });
}
