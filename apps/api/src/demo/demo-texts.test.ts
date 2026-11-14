import { applicationPatchSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { type DemoStoryApplication, loadDemoStory } from './demo-story.js';
import { DEMO_APPLICATION_TEXTS } from './demo-texts.js';

const reachesTechInterview = ({ events }: DemoStoryApplication) =>
  events.some(({ toStage }) => toStage === 'tech_interview');

describe('the demo application texts', () => {
  it('names 54 distinct companies with fields the application schema accepts', () => {
    const companies = DEMO_APPLICATION_TEXTS.map(({ company }) => company);

    expect(new Set(companies).size).toBe(54);
    for (const { company, position, stack, workMode } of DEMO_APPLICATION_TEXTS) {
      expect(() =>
        applicationPatchSchema.parse({ company, position, stack: [...stack], workMode }),
      ).not.toThrow();
    }
  });

  it('puts a live coding note on exactly the journeys that reached tech_interview', async () => {
    const story = await loadDemoStory();
    const reachedTechInterview = story.applications.flatMap((application, index) =>
      reachesTechInterview(application) ? [index] : [],
    );
    const noted = DEMO_APPLICATION_TEXTS.flatMap(({ liveCodingNote }, index) =>
      /live coding/i.test(liveCodingNote ?? '') ? [index] : [],
    );

    expect(reachedTechInterview).toEqual([9, 20, 21, 22, 30, 31, 32, 33, 34]);
    expect(noted).toEqual(reachedTechInterview);
    expect(DEMO_APPLICATION_TEXTS.filter(({ liveCodingNote }) => liveCodingNote)).toHaveLength(9);
  });
});
