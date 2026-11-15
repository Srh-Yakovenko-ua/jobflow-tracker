'use client';

import { Printer } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
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
      <Button
        icon={<Printer aria-hidden size={16} strokeWidth={1.9} />}
        onClick={() => {
          window.print();
        }}
      >
        {COPY.print}
      </Button>
    </div>
  );
}
