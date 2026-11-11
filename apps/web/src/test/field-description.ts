export function descriptionOf(control: HTMLElement): string | null | undefined {
  const describedBy = control.getAttribute('aria-describedby') ?? '';
  const description = document.getElementById(describedBy)?.textContent;
  return description === '' ? undefined : description;
}
