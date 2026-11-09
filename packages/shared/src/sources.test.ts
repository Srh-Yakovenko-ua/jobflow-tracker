import { describe, expect, it } from 'vitest';

import { sourceOfUrl } from './sources.js';

describe('sourceOfUrl', () => {
  it.for([
    { url: 'https://djinni.co/jobs/712345-senior-frontend-engineer/', source: 'djinni' },
    { url: 'https://jobs.dou.ua/companies/grammarly/vacancies/298471/', source: 'dou' },
    { url: 'https://robota.ua/company3301/vacancy10412345', source: 'robota' },
    { url: 'https://linkedin.com/jobs/view/4012345678', source: 'linkedin' },
    { url: 'https://www.linkedin.com/jobs/view/4012345678', source: 'linkedin' },
    { url: 'https://ua.linkedin.com/jobs/view/4012345678', source: 'linkedin' },
    { url: 'HTTP://DJINNI.CO:80/jobs/?primary_keyword=React', source: 'djinni' },
  ])('reads $source from $url', ({ url, source }) => {
    expect(sourceOfUrl(url)).toBe(source);
  });

  it.for([
    {
      label: 'a host that only ends in the letters of djinni.co',
      url: 'https://notdjinni.co/jobs/1',
    },
    {
      label: 'djinni.co as a subdomain of another site',
      url: 'https://djinni.co.evil.example/jobs/1',
    },
    { label: 'dou.ua without the jobs subdomain', url: 'https://dou.ua/lenta/articles/1/' },
    {
      label: 'djinni.co in the path of another host',
      url: 'https://evil.example/djinni.co/jobs/1',
    },
    {
      label: 'djinni.co in the query of another host',
      url: 'https://evil.example/?next=https://djinni.co/jobs/1',
    },
    { label: 'djinni.co as the user name of another host', url: 'https://djinni.co@evil.example/' },
    { label: 'a host outside the table', url: 'https://www.work.ua/jobs/5012345/' },
    { label: 'a host without a scheme', url: 'djinni.co/jobs/1' },
    { label: 'garbage', url: 'not a url' },
    { label: 'an empty string', url: '' },
    { label: 'null', url: null },
    { label: 'no url', url: undefined },
  ])('answers other for $label', ({ url }) => {
    expect(sourceOfUrl(url)).toBe('other');
  });
});
