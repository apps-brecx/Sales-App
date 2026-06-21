import { getAllSettings } from './db';

// Capabilities an admin can grant/revoke for the Manager role.
export const MANAGER_PERMS = [
  'see_all_leads', 'see_team_activity', 'access_dashboard', 'reassign_leads',
  'delete_leads', 'import_pool', 'manage_users', 'manage_audits',
] as const;
export type ManagerPerm = (typeof MANAGER_PERMS)[number];

export const MANAGER_PERM_LABELS: Record<ManagerPerm, string> = {
  see_all_leads: 'See all leads (not just their own)',
  see_team_activity: 'See team activity, notifications & audit overview',
  access_dashboard: 'Access the Dashboard',
  reassign_leads: 'Reassign & bulk-edit leads',
  delete_leads: 'Delete / trash leads',
  import_pool: 'Import leads & manage the pool',
  manage_users: 'Manage users',
  manage_audits: 'Create & manage audits and questions',
};

export async function getManagerPerms(): Promise<Record<ManagerPerm, boolean>> {
  const s: any = await getAllSettings();
  let raw: any = {};
  try { raw = JSON.parse(s.manager_perms || '{}'); } catch {}
  const out: any = {};
  for (const k of MANAGER_PERMS) out[k] = raw[k] !== false; // default ON
  return out as Record<ManagerPerm, boolean>;
}

// True when the user may use a capability. Admin: always. Manager: per settings. Others: no.
export async function can(role: string, perm: ManagerPerm): Promise<boolean> {
  if (role === 'admin') return true;
  if (role === 'manager') return (await getManagerPerms())[perm];
  return false;
}

// True only for a manager who is missing the permission (used to narrow manager access
// without affecting admins, salespeople or viewers).
export async function managerLacks(role: string, perm: ManagerPerm): Promise<boolean> {
  if (role !== 'manager') return false;
  return !(await getManagerPerms())[perm];
}
