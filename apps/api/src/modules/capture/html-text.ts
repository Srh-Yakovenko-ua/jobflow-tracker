import { Parser } from 'htmlparser2';

const DROPPED_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head']);

const LINE_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

function tidied(text: string): string {
  return text
    .replaceAll(/ {2,}/g, ' ')
    .replaceAll(/ ?\n ?/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

export function textOfHtml(html: string): string {
  const chunks: string[] = [];
  let droppedDepth = 0;
  const parser = new Parser({
    onopentagname(name) {
      droppedDepth += DROPPED_TAGS.has(name) ? 1 : 0;
      if (LINE_TAGS.has(name)) chunks.push('\n');
    },
    ontext(text) {
      if (droppedDepth === 0) chunks.push(text.replaceAll(/\s+/g, ' '));
    },
    onclosetag(name, isImplied) {
      droppedDepth -= DROPPED_TAGS.has(name) ? 1 : 0;
      if (LINE_TAGS.has(name) && !isImplied) chunks.push('\n');
    },
  });
  parser.write(html);
  parser.end();
  return tidied(chunks.join(''));
}
