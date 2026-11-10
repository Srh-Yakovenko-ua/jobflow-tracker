import { describe, expect, it } from 'vitest';

import { textOfHtml } from './html-text.js';

const NESTED_DIVS = 50_000;

const HOSTILE_PAGE_LIMIT_MS = 250;

const VACANCY_PAGE = `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8">
    <title>Middle Node.js developer | Robota Hub</title>
  </head>
  <body>
    <header>
      <nav><a href="/">Robota Hub</a> <a href="/vacancies">Вакансії</a></nav>
    </header>
    <main>
      <style>.salary { font-weight: 700 } .stolen { color: red }</style>
      <h1>Middle Node.js developer</h1>
      <div class="meta">
        <span class="salary">2500-3200 USD</span>
        <span class="place">Львів, гібрид</span>
      </div>
      <section class="description">
        <p>Шукаємо розробника в команду <b>платежів</b>.</p>
        <ul>
          <li>NestJS та PostgreSQL</li>
          <li>Досвід від 2 років</li>
        </ul>
        <p>Пишіть на <a href="mailto:hr@robota.example.test">hr@robota.example.test</a></p>
      </section>
      <script type="application/ld+json">
        { "@type": "JobPosting", "title": "stolen", "description": "<p>stolen</p>" }
      </script>
      <noscript><p>Увімкніть JavaScript, stolen</p></noscript>
    </main>
    <footer><p>2026 Robota Hub</p></footer>
  </body>
</html>`;

const VACANCY_PAGE_TEXT = [
  'Robota Hub Вакансії',
  'Middle Node.js developer',
  '2500-3200 USD Львів, гібрид',
  'Шукаємо розробника в команду платежів.',
  'NestJS та PostgreSQL',
  'Досвід від 2 років',
  'Пишіть на hr@robota.example.test',
  '2026 Robota Hub',
].join('\n\n');

describe('textOfHtml', () => {
  it.each([
    { html: 'plain text', text: 'plain text' },
    { html: '<p>Senior <b>React</b> developer</p>', text: 'Senior React developer' },
    {
      html: 'Acme &amp; Co &lt;remote&gt; &#8212; 4000&nbsp;USD',
      text: 'Acme & Co <remote> — 4000 USD',
    },
    { html: '<h1>Acme</h1><p>Remote</p>', text: 'Acme\n\nRemote' },
    { html: '<ul><li>React</li><li>TypeScript</li></ul>', text: 'React\n\nTypeScript' },
    { html: 'Kyiv<br>Lviv<br/>Remote', text: 'Kyiv\nLviv\nRemote' },
    { html: 'React<br><br><br><br>Node', text: 'React\n\nNode' },
    { html: '<p>React,\n   TypeScript \t and\r\nNode</p>', text: 'React, TypeScript and Node' },
    { html: '<span> React </span><span> Node </span>', text: 'React Node' },
    { html: '<div>  React  </div>\n\n<div>  Node  </div>', text: 'React\n\nNode' },
    { html: '<p>React<p>Node', text: 'React\nNode' },
    { html: 'React &#0; Node', text: 'React � Node' },
  ])('keeps the text of $html', ({ html, text }) => {
    expect(textOfHtml(html)).toBe(text);
  });

  it.each([
    { part: 'a script', html: 'React<script>alert("stolen")</script>' },
    { part: 'a style', html: 'React<style>.stolen { color: red }</style>' },
    { part: 'an unclosed script', html: 'React<script>var stolen = "<p>stolen</p>"' },
    { part: 'a script holding a tag', html: 'React<script>"<p>stolen</p>"</script>' },
    { part: 'a noscript', html: 'React<noscript><p>stolen</p></noscript>' },
    { part: 'a template', html: 'React<template><p>stolen</p></template>' },
    { part: 'an svg', html: 'React<svg><title>stolen</title><text>stolen</text></svg>' },
    { part: 'the head', html: '<head><title>stolen</title></head><body>React</body>' },
    { part: 'a comment', html: 'React<!-- stolen -->' },
    {
      part: 'an attribute',
      html: '<a href="https://stolen.example.test" title="stolen">React</a>',
    },
    {
      part: 'a script inside a noscript',
      html: 'React<noscript><script>stolen</script>stolen</noscript>',
    },
  ])('drops the text of $part', ({ html }) => {
    expect(textOfHtml(html)).toBe('React');
  });

  it('reads the text after a dropped part again', () => {
    expect(textOfHtml('<style>p{}</style><p>React</p><script>x()</script><p>Node</p>')).toBe(
      'React\n\nNode',
    );
  });

  it.each(['', '   \n ', '<div><br><img src="x.png"></div>', '<script>stolen()</script>'])(
    'answers an empty string for %j, which holds no text',
    (html) => {
      expect(textOfHtml(html)).toBe('');
    },
  );

  it('keeps the text of a vacancy page and drops its script, style and noscript parts', () => {
    expect(textOfHtml(VACANCY_PAGE)).toBe(VACANCY_PAGE_TEXT);
  });

  it.each([
    {
      page: '256 nested divs around the text',
      html: `${'<div>'.repeat(256)}React${'</div>'.repeat(256)}`,
      text: 'React',
    },
    {
      page: '300 sibling paragraphs',
      html: '<p>React</p>'.repeat(300),
      text: `${'React\n\n'.repeat(299)}React`,
    },
    { page: '300 line breaks before the text', html: `${'<br>'.repeat(300)}React`, text: 'React' },
  ])('keeps the text of $page, inside the 256 open tag cap', ({ html, text }) => {
    expect(textOfHtml(html)).toBe(text);
  });

  it.each([
    {
      page: '257 nested divs around the text',
      html: `${'<div>'.repeat(257)}React${'</div>'.repeat(257)}`,
    },
    { page: 'text before 257 unclosed divs', html: `React${'<div>'.repeat(257)}` },
    {
      page: '256 nested divs around a line break',
      html: `${'<div>'.repeat(256)}Before<br>After${'</div>'.repeat(256)}`,
    },
    {
      page: '256 nested divs around a closing line break',
      html: `${'<div>'.repeat(256)}Before</br>After${'</div>'.repeat(256)}`,
    },
    {
      page: '256 nested divs around a stray closing paragraph',
      html: `${'<div>'.repeat(256)}Before</p>After${'</div>'.repeat(256)}`,
    },
  ])('answers an empty string for $page, past the 256 open tag cap', ({ html }) => {
    expect(textOfHtml(html)).toBe('');
  });

  it.each([
    { page: '99 000 unclosed tags', html: '<x>'.repeat(99_000) },
    {
      page: '50 000 unclosed tags before 37 000 stray closing tags',
      html: `${'<x>'.repeat(50_000)}${'</y>'.repeat(37_000)}`,
    },
    {
      page: '50 000 nested divs around the text',
      html: `${'<div>'.repeat(NESTED_DIVS)}React${'</div>'.repeat(NESTED_DIVS)}`,
    },
    { page: '50 000 unclosed divs before the text', html: `${'<div>'.repeat(NESTED_DIVS)}React` },
  ])('answers an empty string for $page within 250 ms', ({ html }) => {
    const startedAt = performance.now();
    const text = textOfHtml(html);
    const elapsedMs = performance.now() - startedAt;

    expect(text).toBe('');
    expect(elapsedMs).toBeLessThan(HOSTILE_PAGE_LIMIT_MS);
  });
});
