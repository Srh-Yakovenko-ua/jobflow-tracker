import { twMerge } from '@tailwind-merge/next/runtime';
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
