import localFont from 'next/font/local';

export const unbounded = localFont({
  src: './fonts/unbounded-variable.woff2',
  weight: '200 900',
  display: 'swap',
  variable: '--font-unbounded',
});

export const onest = localFont({
  src: './fonts/onest-variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-onest',
});
