const VACANCY_BLOCKS = ['.b-vacancy', '.l-vacancy', '.job-post-page', 'article', 'main'];
const PAGE_CHROME = 'nav,footer';
const NOT_VACANCY_TEXT = `${PAGE_CHROME},noscript`;

function textOutsideChrome(node: Element): string {
  if (
    !(node instanceof HTMLElement) ||
    node.matches(NOT_VACANCY_TEXT) ||
    getComputedStyle(node).display === 'none'
  ) {
    return '';
  }
  if (!node.querySelector(PAGE_CHROME)) {
    return node.innerText.trim();
  }
  return Array.from(node.children, textOutsideChrome).filter(Boolean).join('\n');
}

export function pageTextOf(page: Document): string {
  const selected = page.getSelection()?.toString().trim();
  if (selected) {
    return selected;
  }
  for (const selector of VACANCY_BLOCKS) {
    const text = page.querySelector<HTMLElement>(selector)?.innerText.trim();
    if (text) {
      return text;
    }
  }
  return textOutsideChrome(page.body);
}
