import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DOCS_PATHS } from './paths.js';
import { run } from './run.js';

const API_SPECS = [
  { name: 'api', spec: 'docs/api/openapi.json', title: 'JobFlow API' },
  {
    name: 'analytics',
    spec: `${DOCS_PATHS.build}/api/analytics-openapi.json`,
    title: 'JobFlow Analytics',
  },
];

const REDOCLY_ENV = { REDOCLY_TELEMETRY: 'off', REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true' };

const PRINT_STYLE =
  '@media print { .menu-content { display: none !important; } .api-content { width: 100% !important; } }';

function buildHtml({ spec, title, html }) {
  run({
    command: 'redocly',
    args: ['build-docs', spec, '--output', html, '--title', title, '--inlineBundle'],
    env: REDOCLY_ENV,
  });
}

async function printPdf(page, html) {
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.addStyleTag({ content: PRINT_STYLE });
  await page.pdf({
    path: html.replace(/\.html$/, '.pdf'),
    format: 'A4',
    printBackground: true,
  });
}

export async function renderApiDocs(browser, root) {
  const apiDir = path.join(root, DOCS_PATHS.build, 'api');
  mkdirSync(apiDir, { recursive: true });
  const page = await browser.newPage();
  try {
    for (const { name, spec, title } of API_SPECS) {
      const html = path.join(apiDir, `${name}.html`);
      buildHtml({ spec: path.join(root, spec), title, html });
      await printPdf(page, html);
    }
  } finally {
    await page.close();
  }
}
