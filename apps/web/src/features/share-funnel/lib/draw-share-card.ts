import { Chart, type ChartOptions } from 'chart.js';

import { PAGE_FONTS, pageFont } from '@/shared/lib/page-font';

import type { SceneFont, SceneSankey, SceneText, ShareCardScene } from './share-card-scene';

type CanvasSize = Readonly<{ width: number; height: number }>;

const NODE_LABEL = { role: 'ui', size: 18, weight: 600 } as const satisfies SceneFont;

const PARSING = { from: 'from', to: 'to', flow: 'flow' } as const;

const STILL: ChartOptions<'sankey'> = {
  responsive: false,
  animation: false,
  events: [],
  devicePixelRatio: 1,
  plugins: { tooltip: { enabled: false }, legend: { display: false } },
};

function canvasOf({ width, height }: CanvasSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('the browser gave no 2D canvas context');
  return context;
}

function fontOf({ role, size, weight }: SceneFont): string {
  return `${String(weight)} ${String(size)}px ${pageFont(PAGE_FONTS[role])}`;
}

async function loadFonts(scene: ShareCardScene): Promise<void> {
  const fonts = new Set([...scene.texts.map(({ font }) => fontOf(font)), fontOf(NODE_LABEL)]);
  await document.fonts.ready;
  await Promise.all([...fonts].map((font) => document.fonts.load(font)));
}

function sankeyChart(sankey: SceneSankey, context: CanvasRenderingContext2D) {
  const colourOf = (node: string) => sankey.colours[node] ?? sankey.labelColour;
  return new Chart(context, {
    type: 'sankey',
    data: {
      datasets: [
        {
          data: sankey.flows.map((flow) => ({ ...flow })),
          parsing: PARSING,
          labels: { ...sankey.labels },
          colorFrom: ({ raw }) => colourOf(raw.from),
          colorTo: ({ raw }) => colourOf(raw.to),
          colorMode: 'gradient',
          borderWidth: 0,
          nodeLabels: {
            color: sankey.labelColour,
            backgroundColor: sankey.labelBackground,
            font: {
              family: pageFont(PAGE_FONTS.ui),
              size: NODE_LABEL.size,
              weight: NODE_LABEL.weight,
            },
          },
        },
      ],
    },
    options: STILL,
  });
}

function fillTexts(texts: readonly SceneText[], context: CanvasRenderingContext2D): void {
  context.textBaseline = 'alphabetic';
  for (const { text, font, colour, x, y, align } of texts) {
    context.font = fontOf(font);
    context.fillStyle = colour;
    context.textAlign = align;
    context.fillText(text, x, y);
  }
}

function pngOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('the canvas gave no PNG'));
      else resolve(blob);
    }, 'image/png');
  });
}

export async function drawShareCard(scene: ShareCardScene, signal: AbortSignal): Promise<Blob> {
  const card = canvasOf(scene.size);
  const context = contextOf(card);
  const { area } = scene.sankey;
  const plotContext = contextOf(canvasOf(area));
  await loadFonts(scene);
  signal.throwIfAborted();
  context.fillStyle = scene.background;
  context.fillRect(0, 0, scene.size.width, scene.size.height);
  const chart = sankeyChart(scene.sankey, plotContext);
  context.drawImage(chart.canvas, area.x, area.y);
  chart.destroy();
  fillTexts(scene.texts, context);
  return pngOf(card);
}
