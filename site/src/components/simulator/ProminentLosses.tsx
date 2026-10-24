import { SourceChip, TierBadge } from '@/components/ui';
import { IconAnnounced } from '@/components/ui/icons';
import type { Household, UnquantifiedItem } from '@/lib/engine-types';
import { withBase } from '@/lib/site';
import {
  plainText,
  prominentLosses,
  prominentPromises,
  unqTitle,
  uniqueSources,
} from '@/lib/sim/result';
import type { ResultData } from '@/lib/sim/state';

const AGENT_PUBLIC_HREF = '/comprendre/situations/#agent-public-indispensable';

/** Is anyone in the household a salaried public servant? */
export const hasFonctionnaire = (h: Household) =>
  h.adults.some((a) => a.activity === 'salarie' && a.salary?.status === 'fonctionnaire');

function Card({ item, tone }: { item: UnquantifiedItem; tone: 'loss' | 'promise' }) {
  const isPost = item.id === 'postes_publics';
  return (
    <li
      data-testid="prominent-item"
      data-item={item.id}
      className="hatch flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-[var(--tier-announced-bd)] bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md bg-surface px-1">
        <p className="flex items-start gap-2 font-semibold text-ink">
          <IconAnnounced
            size={18}
            className={tone === 'loss' ? 'mt-0.5 shrink-0 text-loss' : 'mt-0.5 shrink-0 text-ink-2'}
          />
          <span>{unqTitle(item)}</span>
        </p>
        <TierBadge tier={item.tier} short size="sm" />
      </div>
      <div className="space-y-1.5 rounded-md bg-surface px-1">
        {item.amountHint && <p className="text-sm font-semibold text-ink-2">{item.amountHint}</p>}
        <p className="text-sm text-ink-2">{plainText(item.detail)}</p>
        {isPost && (
          <p className="text-sm">
            <a href={withBase(AGENT_PUBLIC_HREF)}>
              Ce que le plan prévoit pour les agents publics →
            </a>
          </p>
        )}
        {item.sources.length > 0 && (
          <p className="flex flex-wrap gap-1.5 pt-1">
            {uniqueSources(item.sources).map((s, i) => (
              <SourceChip key={i} label={s.label} href={s.url} />
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Right under the headline, with the same visual weight as the gains: what the plan leaves unquantified
 * AND that could plausibly exceed 50 €/month for THIS household (engine `prominent`), plus the
 * fonctionnaire warning. They are outside the figure above because the text gives no amount.
 */
export function ProminentLosses({
  data,
  household,
  onSeeAll,
}: {
  data: ResultData;
  household: Household;
  onSeeAll: () => void;
}) {
  const c = data.comparison;
  const losses = prominentLosses(c);
  const promises = prominentPromises(c);
  const fonct = hasFonctionnaire(household);
  const postes = losses.find((l) => l.id === 'postes_publics');
  const listed = losses.filter((l) => l.id !== 'postes_publics');
  const total = c.unquantified.losses.length + c.unquantified.promises.length;

  const nothing = listed.length === 0 && promises.length === 0 && !fonct;
  const seeAll =
    total > 0 ? (
      <>
        Le plan laisse {total} point{total > 1 ? 's' : ''} non chiffré{total > 1 ? 's' : ''} pour
        votre foyer, promesses comprises.{' '}
        <button
          type="button"
          onClick={onSeeAll}
          className="rounded-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          Voir la liste complète
        </button>
      </>
    ) : null;

  if (nothing)
    return (
      <p
        data-testid="prominent-losses"
        className="rounded-md bg-sunken px-3.5 py-3 text-[0.9375rem] text-ink-2"
      >
        <strong className="font-semibold text-ink">Ce que le chiffre ne dit pas.</strong> Aucune
        perte non chiffrée importante n’a été repérée pour votre foyer. {seeAll}
      </p>
    );

  return (
    <section aria-labelledby="prominent-title" data-testid="prominent-losses" className="space-y-4">
      <header className="max-w-3xl space-y-1.5">
        <h3
          id="prominent-title"
          className="font-serif text-xl font-medium leading-snug text-ink sm:text-2xl"
        >
          Ce que le chiffre ne dit pas
        </h3>
        <p className="text-[0.9375rem] text-ink-2">
          Le plan ne donne aucun montant pour les points ci-dessous : ils ne sont donc pas dans le
          chiffre du haut. Pour un foyer comme le vôtre, chacun peut dépasser 50 € par mois.
        </p>
      </header>

      {fonct && (
        <div
          role="note"
          data-testid="fonctionnaire-warning"
          className="rounded-lg border-s-4 border-loss bg-loss-soft px-4 py-3 text-[0.9375rem] text-ink"
        >
          <p className="font-semibold">
            Vous êtes fonctionnaire : ce chiffre ne dit rien de votre poste.
          </p>
          <p className="mt-1">
            {postes
              ? `${plainText(postes.title)}. `
              : 'Le plan prévoit de fermer des postes publics et de mettre fin au statut. '}
            Le simulateur ne chiffre pas ce risque : le gain ou la perte affiché suppose que vous
            gardez votre poste.
          </p>
          <p className="mt-1.5">
            <a href={withBase(AGENT_PUBLIC_HREF)}>
              Ce que le plan prévoit pour les agents publics →
            </a>
          </p>
        </div>
      )}

      {listed.length > 0 || promises.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {listed.map((it) => (
            <Card key={it.id} item={it} tone="loss" />
          ))}
          {promises.map((it) => (
            <Card key={it.id} item={it} tone="promise" />
          ))}
        </ul>
      ) : null}

      {seeAll && <p className="text-sm text-ink-2">{seeAll}</p>}
    </section>
  );
}
