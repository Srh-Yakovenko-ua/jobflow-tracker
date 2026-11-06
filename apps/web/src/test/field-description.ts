export function descriptionOf(control: HTMLElement): string | null | undefined {
  const describedBy = control.getAttribute('aria-describedby') ?? '';
  return document.getElementById(describedBy)?.textContent;
}
