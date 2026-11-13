import type { ChartProps } from 'react-chartjs-2';

const drawn: ChartProps<'sankey'>[] = [];

export function Chart(props: ChartProps<'sankey'>) {
  drawn.push(props);
  return <canvas aria-hidden={props['aria-hidden']} />;
}

export function lastDrawnChart(): ChartProps<'sankey'> {
  const last = drawn.at(-1);
  if (last === undefined) throw new Error('no chart drawn yet');
  return last;
}
