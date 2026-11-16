import { buildSummary } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { MONTHLY_SUMMARY_NOTIFICATION, notificationOf } from '../../test/notifications.js';
import { APPLICATION_ID } from '../../test/service-fixtures.js';
import { emailContentOf, isEmailed } from './email-content.js';
import { escapeHtml, renderHtml, renderText } from './email-template.js';

const CONTEXT = {
  summary: buildSummary({ month: '2026-09' }),
  settings: { timezone: 'Europe/Kyiv' },
  webOrigin: 'http://localhost:3000',
  now: new Date('2026-10-01T09:00:00.000Z'),
};

const UNSUBSCRIBE_URL = 'http://localhost:3000/unsubscribe?token=eyJ.payload.sig';

const HOSTILE = notificationOf({
  type: 'silence',
  payload: { items: [{ applicationId: APPLICATION_ID, company: '<script>x</script>', days: 9 }] },
});

function letterOf(notification: typeof HOSTILE) {
  if (!isEmailed(notification)) throw new Error('not an emailed notification');
  return { content: emailContentOf(notification, CONTEXT), unsubscribeUrl: UNSUBSCRIBE_URL };
}

describe('the email template', () => {
  it('compiles the summary under strict MJML with the brand colours, the subject and both links', async () => {
    const letter = letterOf(MONTHLY_SUMMARY_NOTIFICATION);

    const html = await renderHtml(letter);

    expect(html).toContain('<title>Саммарі за вересень готове</title>');
    expect(html).toContain('href="http://localhost:3000/analytics/summary/2026-09"');
    expect(html).toContain(`href="${UNSUBSCRIBE_URL}"`);
    expect(html).toContain('Попросити 2 рефералки');
    for (const hex of ['#F9F6F1', '#FEFDFA', '#2D6BAB', '#26201B']) {
      expect(html).toContain(hex);
    }
  });

  it('writes the plain text part with the same action and unsubscribe links', () => {
    const text = renderText(letterOf(MONTHLY_SUMMARY_NOTIFICATION));

    expect(text).toMatch(/^Саммарі за вересень готове\n\n/);
    expect(text).toContain('Відкрити саммарі: http://localhost:3000/analytics/summary/2026-09');
    expect(text).toContain(`Відписатися від таких листів: ${UNSUBSCRIBE_URL}`);
    expect(text).toContain("- Два тижні алгоритмів перед техінтерв'ю: 3 з 4 відмов");
  });

  it('escapes a company name in the html and keeps it as plain text in the text part', async () => {
    const letter = letterOf(HOSTILE);

    const html = await renderHtml(letter);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;: 9 днів без відповіді');
    expect(renderText(letter)).toContain('- <script>x</script>: 9 днів без відповіді');
  });

  it('escapes every character html reads as markup', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
