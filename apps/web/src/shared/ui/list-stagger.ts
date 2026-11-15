import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { stagger, type Variants } from 'motion/react';

const MS = 1000;

export const ROW: Variants = { hidden: { opacity: 0, y: 4 }, shown: { opacity: 1, y: 0 } };

export const LIST: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: stagger(CHART_THEME.animation.stagger / MS) } },
};

export const LIST_STILL: Variants = { hidden: {}, shown: {} };
