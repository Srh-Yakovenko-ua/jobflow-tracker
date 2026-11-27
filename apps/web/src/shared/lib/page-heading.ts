export const PAGE_HEADING_ID = 'page-heading';

const WAIT_MS = 3000;

export function focusPageHeading(): void {
  const until = performance.now() + WAIT_MS;
  const attempt = () => {
    const heading = document.getElementById(PAGE_HEADING_ID);
    if (heading instanceof HTMLHeadingElement) {
      heading.focus();
      return;
    }
    if (performance.now() < until) requestAnimationFrame(attempt);
  };
  attempt();
}
