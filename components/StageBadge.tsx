import { LeadStage } from '@/types';
import { STAGE_CONFIG, cn } from '@/lib/utils';
export default function StageBadge({ stage }: { stage: LeadStage }) {
  const c = STAGE_CONFIG[stage];
  return (
    <span className={cn('badge', c.color, c.bg, c.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)}/>
      {c.label}
    </span>
  );
}
