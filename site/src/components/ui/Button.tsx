import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Common = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  children: ReactNode;
};
type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** `<button>` or `<a>` styled with the shared `.btn` classes (44 px touch target). */
export function Button(props: AsButton | AsLink) {
  const { variant = 'primary', size = 'md', className, children, ...rest } = props;
  const cls = cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className);
  if ('href' in rest && rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
