import type { Stage } from '@jobflow/shared';

import type { CopyKey } from './copy-uk.js';

export type ToastLook = {
  light: string;
  dark: string;
  font: string;
  radius: string;
  shadow: string;
  spring: string;
  hover: string;
};

export type SharedData = {
  copy: Record<CopyKey, string>;
  stageLabels: Record<Stage, string>;
  textMaxLength: number;
  titleMaxLength: number;
  look: ToastLook;
};

declare const BOOKMARKLET_SHARED: SharedData;

export const SHARED = BOOKMARKLET_SHARED;
