// What's-New announcements / mini product tour.
// To announce a new feature: add an entry with the next id. Users who haven't
// seen up to that id get the tour on their next visit.
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
    id: 1,
    emoji: '📋',
    title: 'Lead Audits are here',
    body: 'Admins schedule audits in Settings — pick a date and which leads to cover. For every lead, you answer a few quick questions and set a plan of action.',
    href: '/audit',
    cta: 'Open Audits',
  },
  {
    id: 2,
    emoji: '✅',
    title: 'Audit right inside a lead',
    body: 'When a lead has a waiting audit, a panel appears on the lead page so you can answer it without leaving — and you’ll see whether last time’s plan got done.',
  },
];

export const LATEST_WHATS_NEW = WHATS_NEW.reduce((m, i) => Math.max(m, i.id), 0);
