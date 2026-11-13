import { Plus } from 'lucide-react';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { buttonLinkClasses } from '@/shared/ui/button';

export function AddApplicationLink() {
  return (
    <Link href="/add" className={buttonLinkClasses({ variant: 'primary', size: 'md' })}>
      <Plus aria-hidden />
      <span className="max-md:sr-only">{uk.shell.addApplication}</span>
    </Link>
  );
}
