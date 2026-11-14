import { Injectable } from '@nestjs/common';

import { localMonthOf } from '../common/year-month.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PlanFromSummary } from '../modules/plans/index.js';
import { ResumeVersionsRepository } from '../modules/resumes/index.js';
import { SearchesRepository } from '../modules/searches/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PutObject } from '../storage/file-storage.js';
import { type DemoAiRun, DemoRepository } from './demo.repository.js';
import {
  demoCompletionOf,
  demoMatchOf,
  demoResumeProfileOf,
  demoSummaryOutput,
} from './demo-ai.js';
import { demoCvPdf } from './demo-cv.js';
import { applicationPlansOf, summaryInstantOf, versionRowsOf } from './demo-rows.js';
import type { DemoStory } from './demo-story.js';

export type DemoStoryTarget = { email: string; story: DemoStory };

export type DemoStoryWritten = {
  userId: string;
  summary: PlanFromSummary;
  matches: number;
  cvFiles: PutObject[];
};

type StoryOwner = { userId: string; story: DemoStory; tx: Prisma.TransactionClient };

type VersionIds = Map<number, string>;

type ResumeWritten = { versionIds: VersionIds; cvFiles: PutObject[] };

const DEMO_STORY = {
  activeVersion: 2,
  cvMime: 'application/pdf',
  cvRole: 'Frontend Developer',
  transactionTimeoutMs: 30_000,
} as const;

const cvFilenameOf = (number: number) => `cv-v${String(number)}.pdf`;

const cvKeyOf = (userId: string, number: number) => `demo/${userId}/${cvFilenameOf(number)}`;

@Injectable()
export class DemoStoryWriter {
  constructor(
    private readonly repository: DemoRepository,
    private readonly searches: SearchesRepository,
    private readonly resumes: ResumeVersionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  replace({ email, story }: DemoStoryTarget): Promise<DemoStoryWritten> {
    return this.prisma.$transaction(
      async (tx) => {
        const userId = await this.repository.findUserId({ email, tx });
        if (userId === null) {
          throw new Error(`${email} is missing after the seed`);
        }
        await this.repository.wipe(userId, { tx });
        const owner = { userId, story, tx };
        const { versionIds, cvFiles } = await this.writeResume(owner);
        const matchRuns = await this.writeApplications(owner, versionIds);
        const summary = await this.writeAiRuns(owner, matchRuns);
        const activeResumeVersionId = versionIds.get(DEMO_STORY.activeVersion) ?? null;
        await this.repository.updateSettings(userId, {
          activeResumeVersionId,
          timezone: story.timezone,
          tx,
        });
        return { userId, summary, matches: matchRuns.length, cvFiles };
      },
      { timeout: DEMO_STORY.transactionTimeoutMs },
    );
  }

  private async writeResume({ userId, story, tx }: StoryOwner): Promise<ResumeWritten> {
    const createdAt = story.searchStartedAt;
    const resumeId = await this.resumes.findOrCreateResume(userId, { createdAt, tx });
    const versionIds: VersionIds = new Map();
    const cvFiles: PutObject[] = [];
    for (const { number, title, uploadedAt } of versionRowsOf(story)) {
      const cvFile = {
        key: cvKeyOf(userId, number),
        bytes: demoCvPdf({ number, title: DEMO_STORY.cvRole }),
        mime: DEMO_STORY.cvMime,
      };
      const data = {
        filename: cvFilenameOf(number),
        mime: cvFile.mime,
        sizeBytes: cvFile.bytes.length,
        storageKey: cvFile.key,
        resumeId,
        number,
        title,
        uploadedAt,
        createdAt: uploadedAt,
        aiProfile: demoResumeProfileOf(number),
      };
      const { id } = await this.resumes.insert(userId, { data, tx });
      versionIds.set(number, id);
      cvFiles.push(cvFile);
    }
    return { versionIds, cvFiles };
  }

  private async writeApplications(
    { userId, story, tx }: StoryOwner,
    versionIds: VersionIds,
  ): Promise<DemoAiRun[]> {
    const startedAt = story.searchStartedAt;
    const search = { startedAt, createdAt: startedAt, tx };
    const { id: searchId } = await this.searches.createActive(userId, search);
    const runs: DemoAiRun[] = [];
    for (const [index, { resumeVersion, row }] of applicationPlansOf(story).entries()) {
      const resumeVersionId = versionIds.get(resumeVersion) ?? null;
      const { output, score } = demoMatchOf(index);
      const application = { searchId, resumeVersionId, matchScore: score, row, tx };
      const applicationId = await this.repository.createApplication(userId, application);
      const completion = demoCompletionOf('match', { inputHash: `demo:${String(index)}`, output });
      runs.push({ completion, at: row.appliedAt, applicationId, resumeVersionId });
    }
    return runs;
  }

  private async writeAiRuns(
    { userId, story, tx }: StoryOwner,
    matchRuns: DemoAiRun[],
  ): Promise<PlanFromSummary> {
    const at = summaryInstantOf(story);
    const month = localMonthOf(story.timezone, at);
    const output = demoSummaryOutput();
    const completion = demoCompletionOf('monthly_summary', { inputHash: `demo:${month}`, output });
    const summaryRun = { completion, at, applicationId: null, resumeVersionId: null };
    const resultIds = await this.repository.createAiRuns(userId, {
      runs: [...matchRuns, summaryRun],
      tx,
    });
    const aiResultId = resultIds.get(completion.inputHash);
    if (aiResultId === undefined) {
      throw new Error('The demo summary result was not written');
    }
    return { aiResultId, month, actions: output.actions };
  }
}
