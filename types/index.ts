export type UserRole = 'admin' | 'manager' | 'salesman' | 'viewer';
export type LeadStage = 'new' | 'contacted' | 'follow_up' | 'proposal' | 'closed_won' | 'closed_lost';

export interface User {
  id: number; name: string; email: string; role: UserRole;
  is_active: number; created_at: string;
}

export interface Lead {
  id: number; company_name: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null;
  stage: LeadStage; assigned_to: number | null; assigned_name?: string | null;
  source: 'email' | 'manual'; notes: string | null;
  deleted_at: string | null; created_at: string; updated_at: string;
  update_count?: number; last_update?: string | null;
}

export interface LeadUpdate {
  id: number; lead_id: number; user_id: number | null; user_name?: string | null;
  content: string; stage_from: LeadStage | null; stage_to: LeadStage | null;
  created_at: string; source: 'email' | 'manual'; email_date: string | null;
}

export interface Message {
  id: number; from_user_id: number; to_user_id: number | null;
  from_name?: string; to_name?: string;
  subject: string; body: string; lead_id: number | null;
  lead_name?: string; is_read: number; created_at: string;
}

export interface CalendarEvent {
  id: number; user_id: number; lead_id: number | null;
  lead_name?: string; title: string; description: string | null;
  event_date: string; event_time: string | null; type: string; created_at: string;
}
