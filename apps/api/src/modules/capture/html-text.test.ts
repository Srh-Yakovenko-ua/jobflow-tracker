import { describe, expect, it } from 'vitest';

import { textOfHtml } from './html-text.js';

const NESTED_DIVS = 50_000;
const DEEP_NESTING_TIMEOUT_MS = 30_000;

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

  it(
    'reads the text inside 50 000 nested divs without throwing',
    { timeout: DEEP_NESTING_TIMEOUT_MS },
    () => {
      const html = `${'<div>'.repeat(NESTED_DIVS)}React${'</div>'.repeat(NESTED_DIVS)}`;

      expect(textOfHtml(html)).toBe('React');
    },
  );

  it(
    'reads the text inside 50 000 unclosed divs without throwing',
    { timeout: DEEP_NESTING_TIMEOUT_MS },
    () => {
      expect(textOfHtml(`${'<div>'.repeat(NESTED_DIVS)}React`)).toBe('React');
    },
  );
});
