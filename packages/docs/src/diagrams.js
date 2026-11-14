import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { DOCS_PATHS } from './paths.js';

const DIAGRAM_RULES = {
  script: createRequire(import.meta.url).resolve('mermaid/dist/mermaid.min.js'),
  block: /```mermaid\n([\s\S]*?)\n```/,
  pixelRatio: 2,
  roughSeed: 1,
};

export function mermaidSource(markdown) {
  const block = markdown.match(DIAGRAM_RULES.block)?.[1];
  if (block === undefined) {
    throw new Error('The markdown file holds no mermaid block');
  }
  return block;
}

export const figureOutput = (entry, extension) =>
  `${DOCS_PATHS.build}/figures/${entry.id}.${extension}`;

function diagramText(root, source) {
  const text = readFileSync(path.join(root, source), 'utf8');
  return source.endsWith('.md') ? mermaidSource(text) : text;
}

function renderSvg(page, figure) {
  return page.evaluate(
    async ({ id, text, seed }) => {
      const { mermaid } = globalThis;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        deterministicIds: true,
        deterministicIDSeed: id,
        handDrawnSeed: seed,
      });
      const { svg } = await mermaid.render(`figure-${id}`, text);
      return svg;
    },
    { ...figure, seed: DIAGRAM_RULES.roughSeed },
  );
}

async function writePng(page, { svg, output }) {
  await page.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
  await page.locator('svg').first().screenshot({ path: output });
}

export async function renderDiagrams(browser, { root, entries }) {
  mkdirSync(path.join(root, DOCS_PATHS.build, 'figures'), { recursive: true });
  const context = await browser.newContext({ deviceScaleFactor: DIAGRAM_RULES.pixelRatio });
  try {
    const renderer = await context.newPage();
    await renderer.addScriptTag({ path: DIAGRAM_RULES.script });
    const shooter = await context.newPage();
    for (const entry of entries.filter(({ type }) => type === 'diagram')) {
      const svg = await renderSvg(renderer, {
        id: entry.id,
        text: diagramText(root, entry.source),
      });
      writeFileSync(path.join(root, figureOutput(entry, 'svg')), svg);
      await writePng(shooter, { svg, output: path.join(root, figureOutput(entry, 'png')) });
    }
  } finally {
    await context.close();
  }
}
