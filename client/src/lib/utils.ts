import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Role } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function roleLabel(role: Role | undefined | null): string {
  if (role === 'TEACHER') return 'Faculty';
  if (role === 'STUDENT') return 'Student';
  if (role === 'ADMIN') return 'Admin';
  return '';
}
