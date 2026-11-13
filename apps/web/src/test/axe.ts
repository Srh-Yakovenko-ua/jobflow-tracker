import axe from 'axe-core';

export async function axeViolations(context: Element = document.body) {
  const { violations } = await axe.run(context);
  return violations;
}
