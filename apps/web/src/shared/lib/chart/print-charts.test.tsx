import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrintCharts } from './print-charts';

const { resize } = vi.hoisted(() => ({ resize: vi.fn() }));

vi.mock('chart.js', () => ({ Chart: { instances: { sankey: { resize } } } }));

function print() {
  window.dispatchEvent(new Event('beforeprint'));
}

describe('PrintCharts', () => {
  beforeEach(() => {
    resize.mockClear();
  });

  it('resizes every drawn chart when the browser opens the print dialog and again when it closes', () => {
    render(<PrintCharts>{null}</PrintCharts>);

    print();
    window.dispatchEvent(new Event('afterprint'));

    expect(resize).toHaveBeenCalledTimes(2);
  });

  it('leaves the charts alone once the report is gone', () => {
    render(<PrintCharts>{null}</PrintCharts>).unmount();

    print();

    expect(resize).not.toHaveBeenCalled();
  });
});
