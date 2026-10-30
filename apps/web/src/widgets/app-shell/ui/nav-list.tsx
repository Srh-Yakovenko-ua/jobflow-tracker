import { cn } from '@/shared/lib/cn';

import { navStatusOf, type ShellNav } from '../model/nav-items';
import { NavLink, type NavLinkVariant } from './nav-link';

export type NavListProps = Readonly<{
  nav: ShellNav;
  variant: NavLinkVariant;
  className?: string;
}>;

export function NavList({ nav, variant, className }: NavListProps) {
  return (
    <ul className={cn('flex', className)}>
      {nav.items.map((item) => (
        <li key={item.id} className={cn(variant === 'bar' && 'flex min-w-0 flex-1')}>
          <NavLink item={item} status={navStatusOf(nav, item)} variant={variant} />
        </li>
      ))}
    </ul>
  );
}
