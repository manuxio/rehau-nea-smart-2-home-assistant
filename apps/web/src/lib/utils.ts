import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const fmtAgo = (iso: string): string => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s fa`;
  if (s < 3600) return `${Math.round(s / 60)}m fa`;
  if (s < 86_400) return `${Math.round(s / 3600)}h fa`;
  return `${Math.round(s / 86_400)}g fa`;
};

export const fmtTemp = (n: number, digits = 1): string => n.toFixed(digits);
