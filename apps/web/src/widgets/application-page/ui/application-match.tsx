import type { AiJobStatus } from '@jobflow/shared';
import Link from 'next/link';

import { ScoreBadge } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { AsyncState } from '@/shared/ui/async-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { Reveal } from '@/shared/ui/reveal';
import { TextSkeleton } from '@/shared/ui/skeleton';
import { STATE_TEXT } from '@/shared/ui/state-text';

import type { MatchView } from '../lib/match-view';
import type { ApplicationMatchState } from '../model/use-application-match';
import { ApplicationSection } from './application-section';
import { MatchBreakdown } from './match-breakdown';

export type ApplicationMatchProps = Readonly<{ match: ApplicationMatchState }>;

type ViewProps = Readonly<{ view: MatchView | null }>;

type StateProps = Readonly<{ view: MatchView; job: ApplicationMatchState['job'] }>;

const COPY = uk.applicationPage.match;

const RESUMES_HREF = '/resumes';

const HEADER =
  'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 [&>h2]:col-start-1 [&>h2]:row-start-2';

const WAITING_STATUS: Readonly<Record<MatchView['kind'], AiJobStatus | null>> = {
  no_cv: null,
  pending: 'processing',
  failed: 'failed',
  scored: null,
  unscored: null,
};

const STATE_BODY: Readonly<Record<MatchView['kind'], string>> = {
  no_cv: 'no-score',
  pending: 'job',
  failed: 'job',
  scored: 'breakdown',
  unscored: 'no-score',
};

function MatchTitle({ view }: ViewProps) {
  if (view?.kind === 'scored') {
    return (
      <span key={view.match.score} className="animate-fade-in tabular-nums">
        {COPY.score(view.match.score)}
      </span>
    );
  }
  if (view === null || view.kind === 'unscored') {
    return `${COPY.noScore} ${uk.application.score.empty}`;
  }
  const aiStatus = view.kind === 'pending' ? (view.job?.status ?? 'processing') : null;
  return (
    <span className="inline-flex items-center gap-3">
      {COPY.noScore}
      <ScoreBadge
        application={{ matchScore: null, aiStatus: aiStatus ?? WAITING_STATUS[view.kind] }}
      />
    </span>
  );
}

function NoScore({ view }: ViewProps) {
  if (view?.kind !== 'no_cv') return <p className="text-[13px] text-ink-3">{COPY.unscored}</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-2">
      {COPY.noCv.lead}
      <Link
        href={RESUMES_HREF}
        className="touch-target rounded-xs font-semibold text-link underline-offset-2 hover:underline active:underline"
      >
        {COPY.noCv.link}
      </Link>
    </p>
  );
}

function MatchState({ view, job }: StateProps) {
  if (view.kind === 'scored') return <MatchBreakdown match={view.match} />;
  if (view.kind === 'failed') return <AsyncState job={{ status: 'failed' }} />;
  if (view.kind === 'pending') return <AsyncState job={job} />;
  return <NoScore view={view} />;
}

function MatchBody({ match }: ApplicationMatchProps) {
  const { load, view, job } = match;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  if (view === null) return <TextSkeleton />;
  return (
    <Reveal shown view={{ mode: 'wait', id: STATE_BODY[view.kind] }}>
      <MatchState view={view} job={job} />
    </Reveal>
  );
}

export function ApplicationMatch({ match }: ApplicationMatchProps) {
  const { view, dayLabel } = match;
  const scored = view?.kind === 'scored' ? view.match : null;
  const against = scored !== null && (
    <span
      key={scored.computedAt}
      className="col-start-2 row-start-1 animate-fade-in font-ui text-[11px] font-semibold text-ink-3 tabular-nums"
    >
      {COPY.against(scored.resumeVersion.number, dayLabel(scored.computedAt))}
    </span>
  );
  return (
    <ApplicationSection
      title={{ text: <MatchTitle view={view} />, look: 'display' }}
      header={{
        before: <p className={cn(STATE_TEXT.eyebrow, 'text-ink-3')}>{COPY.kicker}</p>,
        after: against,
        className: HEADER,
      }}
      view={{
        className: 'flex flex-col gap-5 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]',
        busy: view === null || view.kind === 'pending',
      }}
    >
      <MatchBody match={match} />
    </ApplicationSection>
  );
}
