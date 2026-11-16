'use client';

import { uk } from '@/shared/i18n';
import { PrintButton } from '@/shared/ui/print-button';
import { Switch } from '@/shared/ui/switch';

const COPY = uk.analytics.report;

export type SalaryToggle = Readonly<{ hidden: boolean; onHiddenChange: (hidden: boolean) => void }>;

export type ReportToolbarProps = Readonly<{ salary: SalaryToggle }>;

export function ReportToolbar({ salary }: ReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
      <Switch
        label={COPY.hideSalary}
        checked={salary.hidden}
        onCheckedChange={salary.onHiddenChange}
      />
      <PrintButton label={COPY.print} />
    </div>
  );
}
