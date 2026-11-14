import { chromium } from 'playwright';

import { renderDiagrams } from './diagrams.js';
import { writeFigureIndex } from './figure-index.js';
import { loadManifest } from './manifest.js';
import { renderApiDocs } from './openapi.js';
import { REPO_ROOT } from './paths.js';
import { writeTables } from './tables.js';

const entries = loadManifest(REPO_ROOT);
const browser = await chromium.launch();
try {
  await renderDiagrams(browser, { root: REPO_ROOT, entries });
  await renderApiDocs(browser, REPO_ROOT);
  writeTables(REPO_ROOT, entries);
  writeFigureIndex(REPO_ROOT, entries);
} finally {
  await browser.close();
}
