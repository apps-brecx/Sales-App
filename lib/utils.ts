import { clsx, type ClassValue } from 'clsx';
import { LeadStage } from '@/types';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }

export const STAGE_CONFIG: Record<LeadStage, { label: string; color: string; bg: string; border: string; dot: string; ring: string; order: number }> = {
  new:         { label: 'New',         color: 'text-sky-700',    bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500',    ring: 'ring-sky-200',    order: 0 },
  contacted:   { label: 'Contacted',   color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', ring: 'ring-violet-200', order: 1 },
  follow_up:   { label: 'Follow-up',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  ring: 'ring-amber-200',  order: 2 },
  proposal:    { label: 'Proposal',    color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', ring: 'ring-orange-200', order: 3 },
  closed_won:  { label: 'Won ✓',       color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',dot: 'bg-emerald-500',ring: 'ring-emerald-200',order: 4 },
  closed_lost: { label: 'Lost',        color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200',   dot: 'bg-rose-500',   ring: 'ring-rose-200',   order: 5 },
};

export const ALL_STAGES: LeadStage[] = ['new','contacted','follow_up','proposal','closed_won','closed_lost'];

export const ROLE_CONFIG = {
  admin:    { label: 'Admin',    color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200'    },
  manager:  { label: 'Manager',  color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200'  },
  salesman: { label: 'Salesman', color: 'text-brand-700',   bg: 'bg-brand-50',   border: 'border-brand-200'   },
  viewer:   { label: 'Viewer',   color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200'   },
};

export const EVENT_TYPES = ['Meeting','Call','Follow-up','Demo','Proposal','Other'];

export function formatDate(d: string) { try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; } }
export function formatDateTime(d: string) { try { return format(parseISO(d), 'MMM d, yyyy · h:mm a'); } catch { return d; } }
export function timeAgo(d: string) { try { return formatDistanceToNow(parseISO(d), { addSuffix: true }); } catch { return d; } }
export function formatMonthDay(d: string) { try { return format(parseISO(d), 'MMM d'); } catch { return d; } }
