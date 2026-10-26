import type { UnquantifiedItem } from '@/lib/engine-types';
import { Unquantified } from './Unquantified';
import { NotModelled } from './Hypotheses';

/** « Ce que le simulateur ne compte pas »: unquantified promises and losses, then the modelling limits. */
export function NotCounted({
  promises,
  losses,
  notModelled,
}: {
  promises: UnquantifiedItem[];
  losses: UnquantifiedItem[];
  notModelled: string[];
}) {
  return (
    <div className="space-y-8">
      <Unquantified promises={promises} losses={losses} />
      <NotModelled items={notModelled} />
    </div>
  );
}
