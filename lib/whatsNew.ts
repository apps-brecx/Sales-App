// What's-New announcements / guided tour.
// To announce a feature: add an entry with the next id. Users who haven't seen up
// to that id get the tour (Skip / Next) on their next visit.
export type WhatsNewItem = {
  id: number;
  emoji: string;
  title: string;
  body: string;
  href?: string;   // optional CTA link
  cta?: string;    // CTA label
  roles?: string[]; // limit to roles; omit for everyone
};

export const WHATS_NEW: WhatsNewItem[] = [
  {
    id: 1, emoji: '👋', title: "What's new — quick tour",
    body: "A lot landed recently. Here's a 30-second walkthrough of everything you can now do. Hit Next, or Skip anytime.",
  },
  {
    id: 2, emoji: '📋', title: 'Lead Audits',
    body: 'Admins schedule audits; for each lead you answer a few quick questions, check whether last time’s plan got done, and set the next plan of action. You can do it on the Audits page or right inside a lead.',
    href: '/audit', cta: 'Open Audits',
  },
  {
    id: 3, emoji: '📬', title: 'Email — connected to your leads',
    body: 'Connect your Gmail (IMAP/SMTP) and get a full mailbox: threads linked to leads, list/table views, compose & reply with Syruvia AI, schedule send, summaries, and a per-thread Autopilot.',
    href: '/emails', cta: 'Open Email',
  },
  {
    id: 4, emoji: '✍️', title: 'Signature & out-of-office',
    body: 'In Email, set your signature (auto-added to messages) and an out-of-office auto-reply that answers incoming mail once per conversation while you’re away.',
    href: '/emails', cta: 'Open Email',
  },
  {
    id: 5, emoji: '🏬', title: 'Referrals',
    body: 'Track stores you’re getting to request Syruvia from their distributor (e.g. Sysco). Add a store, set status (new → requested → stocked), log updates, and email them — filtered by distributor.',
    href: '/referrals', cta: 'Open Referrals',
  },
  {
    id: 6, emoji: '🧲', title: 'Lead Pool',
    body: 'Unassigned leads, grouped by category. Grab one to add it to your own leads and start working it. Admins import leads into the pool by category.',
    href: '/pool', cta: 'Open Lead Pool',
  },
  {
    id: 7, emoji: '🏷️', title: 'Lead categories & richer leads',
    body: 'Leads are grouped by category (national stores, distributors, local). Each lead now also has a Next action (mark done / snooze), deal value, expected close, and a lead score.',
    href: '/leads', cta: 'Open Leads',
  },
  {
    id: 8, emoji: '📁', title: 'Files',
    body: 'Shared files your admin posts for everyone, plus your own private files — upload and download right in the app.',
    href: '/files', cta: 'Open Files',
  },
  {
    id: 9, emoji: '🛠️', title: 'Manager controls', roles: ['admin'],
    body: 'In Settings you can switch each Manager capability on/off (see all leads, team activity, dashboard, reassign, delete, import, users, audits). Managers get a Sales ⇄ Manager view switch.',
    href: '/settings', cta: 'Open Settings',
  },
  {
    id: 10, emoji: '🔀', title: 'Sales & Manager views', roles: ['manager'],
    body: 'You have a Sales view (your own leads, audits, home) and a Manager view (the team). Switch them at the top of the sidebar — and filter leads by salesperson.',
    href: '/leads', cta: 'Open Leads',
  },
];

export const LATEST_WHATS_NEW = WHATS_NEW.reduce((m, i) => Math.max(m, i.id), 0);
