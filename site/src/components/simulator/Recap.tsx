import { useState } from 'react';
import { Disclosure } from '@/components/ui';
import type { Household } from '@/lib/engine-types';
import type { StepId } from '@/lib/sim/form';
import { buildRecap } from '@/lib/sim/recap';

/**
 * « Votre situation : … » — the answers behind the figure, in plain French, each group editable.
 * Built from the household itself, so a shared link shows exactly what its sender answered.
 */
export function Recap({
  household,
  onEdit,
  shared,
}: {
  household: Household;
  onEdit: (step: StepId) => void;
  shared?: boolean;
}) {
  const groups = buildRecap(household);
  // On a phone the recap folds away (the answers are one tap off), unless it is somebody else's: then it
  // is the first thing to read. The result is built in the browser, so reading the viewport here is safe.
  const [foldable] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639.98px)').matches,
  );
  return (
    <section aria-labelledby="recap-title" data-testid="recap" className="card space-y-3">
      <h3 id="recap-title" className="font-serif text-xl font-medium text-ink sm:text-2xl">
        Votre situation
      </h3>
      <p className="text-sm text-ink-2">
        {shared
          ? 'Voici les réponses de la personne qui a partagé ce résultat. Le chiffre n’a de sens que pour cette situation.'
          : 'Le résultat repose sur ces réponses. Une erreur ? Corrigez-la, le résultat se met à jour.'}
      </p>
      {foldable && !shared ? (
        <Disclosure variant="card" summary="Voir mes réponses et les modifier" meta="5 réponses">
          <RecapRows groups={groups} onEdit={onEdit} />
        </Disclosure>
      ) : (
        <RecapRows groups={groups} onEdit={onEdit} />
      )}
    </section>
  );
}

function RecapRows({
  groups,
  onEdit,
}: {
  groups: ReturnType<typeof buildRecap>;
  onEdit: (step: StepId) => void;
}) {
  return (
    <>
      <dl className="divide-y divide-rule border-y border-rule">
        {groups.map((g) => (
          <div
            key={g.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:py-2.5"
          >
            <dt className="col-start-1 row-start-1 text-sm font-semibold text-ink-3">{g.label}</dt>
            <dd
              className="col-start-1 row-start-2 text-[0.9375rem] text-ink sm:col-start-2 sm:row-start-1"
              data-recap={g.id}
            >
              {g.text}
            </dd>
            <dd className="col-start-2 row-span-2 row-start-1 sm:col-start-3 sm:row-span-1">
              <button
                type="button"
                onClick={() => onEdit(g.step)}
                aria-label={`Modifier : ${g.label}`}
                className="rounded-sm px-1.5 py-1 text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                Modifier
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
