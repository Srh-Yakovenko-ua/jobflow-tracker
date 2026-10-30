import { Plus } from 'lucide-react';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonClasses } from '@/shared/ui/button';

const LINK_HOVER =
  'hover:-translate-y-px hover:bg-accent-press active:translate-y-0 dark:hover:text-paper';

export function AddApplicationLink() {
  return (
    <Link
      href="/add"
      className={cn(
        buttonClasses({ variant: 'primary', size: 'md', iconOnly: false, dimmed: false }),
        LINK_HOVER,
      )}
    >
      <Plus aria-hidden />
      {uk.shell.addApplication}
    </Link>
  );
}
