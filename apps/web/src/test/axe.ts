import axe from 'axe-core';

export async function axeViolations() {
  const { violations } = await axe.run(document.body);
  return violations;
}
