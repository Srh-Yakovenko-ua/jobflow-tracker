import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoteMarkdown, NotePlainText } from './note-markdown';

const ACTIVE_CONTENT = 'img, script, a, iframe, [href], [src], [onerror], [onmouseover]';

const HTML_BODIES = [
  { name: 'an img with onerror', body: '<img src=x onerror=alert(1)>' },
  { name: 'a script block', body: '<script>alert(1)</script>' },
  { name: 'inline html with a handler', body: 'Тимлід <b onmouseover=alert(1)>норм</b>' },
  { name: 'an iframe', body: '<iframe src="javascript:alert(1)"></iframe>' },
];

describe('NoteMarkdown', () => {
  it.each(HTML_BODIES)('$name is shown as its literal text and builds no element', ({ body }) => {
    const { container } = render(<NoteMarkdown note={{ body }} />);

    expect(container.textContent).toBe(body);
    expect(container.querySelector(ACTIVE_CONTENT)).toBeNull();
  });

  it.each([
    { name: 'a javascript: link', body: '[x](javascript:alert(1))', text: 'x' },
    { name: 'a javascript: image', body: '![x](javascript:alert(1))', text: '' },
    { name: 'an autolink', body: '<https://evil.example>', text: 'https://evil.example' },
    { name: 'a safe https link', body: '[вакансія](https://jobs.example.com/1)', text: 'вакансія' },
  ])('$name keeps only its text, with no anchor and no href', ({ body, text }) => {
    const { container } = render(<NoteMarkdown note={{ body }} />);

    expect(container.textContent).toBe(text);
    expect(container.querySelector(ACTIVE_CONTENT)).toBeNull();
  });

  it('**bold** renders strong', () => {
    const { container } = render(<NoteMarkdown note={{ body: 'Треба **повторити DP**' }} />);

    expect(container.querySelector('strong')?.textContent).toBe('повторити DP');
  });

  it.each([
    { name: 'a dash list', body: '- DP\n- графи', list: 'ul' },
    { name: 'a numbered list', body: '1. DP\n2. графи', list: 'ol' },
  ])('$name renders its items', ({ body, list }) => {
    const { container } = render(<NoteMarkdown note={{ body }} />);

    expect(container.querySelector(list)).not.toBeNull();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'DP',
      'графи',
    ]);
  });

  it('a heading or a quote is unwrapped to its text', () => {
    const { container } = render(
      <NoteMarkdown note={{ body: '# Підсумок\n\n> стек без легасі' }} />,
    );

    expect(container.querySelector('h1, blockquote')).toBeNull();
    expect(screen.getByText('Підсумок')).toBeDefined();
    expect(screen.getByText('стек без легасі')).toBeDefined();
  });
});

describe('NotePlainText', () => {
  it('**bold** reads as its words, with no asterisks and no strong', () => {
    const { container } = render(<NotePlainText note={{ body: 'Треба **повторити DP**' }} />);

    expect(container.textContent).toBe('Треба повторити DP');
    expect(container.querySelector('strong')).toBeNull();
  });

  it.each(HTML_BODIES)('$name is shown as its literal text and builds no element', ({ body }) => {
    const { container } = render(<NotePlainText note={{ body }} />);

    expect(container.textContent).toBe(body);
    expect(container.querySelector('*')).toBeNull();
  });
});
