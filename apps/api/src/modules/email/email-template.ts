import { RN_THEME } from '@jobflow/shared/rn-theme';
import mjml2html from 'mjml';

import type { EmailContent, EmailItem } from './email-content.js';

export type EmailLetter = { content: EmailContent; unsubscribeUrl: string };

const COLORS = RN_THEME.light.colors;

const FONT_STACK = 'Onest, Arial, sans-serif';

const UNSUBSCRIBE_LABEL = 'Відписатися від таких листів';

const FOOTER_NOTE =
  'Лист від JobFlow Tracker. Листи вмикаються і вимикаються в налаштуваннях, у розділі «Повідомлення».';

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

const linkMarkup = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="color:${COLORS.link}">${escapeHtml(label)}</a>`;

function itemMarkup({ title, detail, url }: EmailItem): string {
  const head = url === null ? `<strong>${escapeHtml(title)}</strong>` : linkMarkup(url, title);
  const tail =
    detail === null
      ? ''
      : `<br /><span style="color:${COLORS['ink-2']}">${escapeHtml(detail)}</span>`;
  return `<mj-text padding-top="6px" padding-bottom="6px">${head}${tail}</mj-text>`;
}

function headMarkup({ subject, preheader }: EmailContent): string {
  return `<mj-head>
    <mj-title>${escapeHtml(subject)}</mj-title>
    <mj-preview>${escapeHtml(preheader)}</mj-preview>
    <mj-attributes>
      <mj-all font-family="${FONT_STACK}" />
      <mj-text color="${COLORS.ink}" font-size="16px" line-height="24px" />
    </mj-attributes>
  </mj-head>`;
}

function cardMarkup({ heading, paragraphs, items, action }: EmailContent): string {
  const divider =
    items.length === 0 ? '' : `<mj-divider border-color="${COLORS.line}" border-width="1px" />`;
  return `<mj-section background-color="${COLORS.surface}" border="1px solid ${COLORS.line}" border-radius="12px" padding="16px 8px">
    <mj-column>
      <mj-text font-size="22px" line-height="30px" font-weight="600">${escapeHtml(heading)}</mj-text>
      ${paragraphs.map((text) => `<mj-text color="${COLORS['ink-2']}">${escapeHtml(text)}</mj-text>`).join('')}
      ${divider}${items.map(itemMarkup).join('')}
      <mj-button href="${escapeHtml(action.url)}" background-color="${COLORS.accent}" color="${COLORS.surface}" border-radius="8px" font-weight="600" align="left">${escapeHtml(action.label)}</mj-button>
    </mj-column>
  </mj-section>`;
}

function footerMarkup(unsubscribeUrl: string): string {
  return `<mj-section padding="16px 0">
    <mj-column>
      <mj-text color="${COLORS['ink-3']}" font-size="12px" line-height="18px">${escapeHtml(FOOTER_NOTE)}<br />${linkMarkup(unsubscribeUrl, UNSUBSCRIBE_LABEL)}</mj-text>
    </mj-column>
  </mj-section>`;
}

function markupOf({ content, unsubscribeUrl }: EmailLetter): string {
  return `<mjml lang="uk">
  ${headMarkup(content)}
  <mj-body background-color="${COLORS.paper}" width="600px">
    <mj-section padding="24px 0 8px">
      <mj-column>
        <mj-text color="${COLORS.accent}" font-size="14px" font-weight="600">JobFlow</mj-text>
      </mj-column>
    </mj-section>
    ${cardMarkup(content)}
    ${footerMarkup(unsubscribeUrl)}
  </mj-body>
</mjml>`;
}

export async function renderHtml(letter: EmailLetter): Promise<string> {
  const { html } = await mjml2html(markupOf(letter), { validationLevel: 'strict' });
  return html;
}

function itemText({ title, detail, url }: EmailItem): string {
  const line = detail === null ? `- ${title}` : `- ${title}: ${detail}`;
  return url === null ? line : `${line}\n  ${url}`;
}

export function renderText({ content, unsubscribeUrl }: EmailLetter): string {
  const { heading, paragraphs, items, action } = content;
  return [
    heading,
    ...paragraphs,
    ...(items.length === 0 ? [] : [items.map(itemText).join('\n')]),
    `${action.label}: ${action.url}`,
    `${FOOTER_NOTE}\n${UNSUBSCRIBE_LABEL}: ${unsubscribeUrl}`,
  ].join('\n\n');
}
