import { Onest, Unbounded } from 'next/font/google';

export const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-unbounded',
});

export const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-onest',
});
