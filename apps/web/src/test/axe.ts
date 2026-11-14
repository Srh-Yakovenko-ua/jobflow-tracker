import axe from 'axe-core';

export async function axeViolations(context: Element = document.body) {
  const { violations } = await axe.run(context);
  return violations;
}

export async function headingProblems() {
  const { violations } = await axe.run(document.body, {
    runOnly: { type: 'rule', values: ['heading-order'] },
  });
  return {
    h1: document.body.querySelectorAll('h1').length,
    violations: violations.map((violation) => violation.id),
  };
}
