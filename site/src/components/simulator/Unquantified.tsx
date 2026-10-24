import { TierBadge, SourceChip } from '@/components/ui';
import { IconAnnounced, IconChevron } from '@/components/ui/icons';
import type { UnquantifiedItem } from '@/lib/engine-types';
import { plainText, unqTitle, uniqueSources } from '@/lib/sim/result';

/** Items shown before « Voir les N autres » — the same limit for both panels. */
const VISIBLE = 4;

export interface UnquantifiedProps {
  promises: UnquantifiedItem[];
  losses: UnquantifiedItem[];
}

/**
 * The two « non chiffré » panels (docs/VISION.md §5.2.4): same size, same dashed hatched treatment,
 * same structure — a promise is given exactly the visual weight of a loss. Outside disposable income.
 */
export function Unquantified({ promises, losses }: UnquantifiedProps) {
  return (
    <section aria-labelledby="unq-title" className="space-y-4">
      <header className="max-w-3xl space-y-1.5">
        <h4
          id="unq-title"
          className="font-serif text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl"
        >
          Ce que le plan promet ou laisse ouvert, sans le chiffrer
        </h4>
        <p className="text-[0.9375rem] text-ink-2">
          Ces éléments ne sont pas comptés dans votre revenu disponible : aucun montant n’est écrit
          dans les amendements. Nous les montrons à part, côte à côte, avec le même poids. Les plus
          importants pour votre foyer sont déjà signalés sous le résultat.
        </p>
      </header>
      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <Panel
          id="unq-promises"
          title="Promesses non chiffrées"
          intro="Annoncées par les auteurs. Le montant serait fixé chaque année par la loi de finances ; 0 € par défaut dans le texte des amendements."
          items={promises}
          empty="Aucune promesse non chiffrée ne concerne votre foyer."
        />
        <Panel
          id="unq-losses"
          title="Pertes non chiffrées"
          intro="Effets défavorables possibles que le texte ne chiffre pas, ou que nous ne savons pas calculer pour vous."
          items={losses}
          empty="Aucune perte non chiffrée ne concerne votre foyer."
        />
      </div>
    </section>
  );
}

function ItemList({ items }: { items: UnquantifiedItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="rounded-md border border-rule bg-surface p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="font-semibold text-ink">{unqTitle(it)}</p>
            <TierBadge tier={it.tier} short size="sm" />
          </div>
          {it.amountHint && (
            <p className="mt-1 text-sm font-semibold text-ink-2">{it.amountHint}</p>
          )}
          <p className="mt-1 text-sm text-ink-2">{plainText(it.detail)}</p>
          {it.plainTitle && it.plainTitle !== it.title && (
            <p className="mt-1 text-xs text-ink-3">Titre exact du texte : {plainText(it.title)}</p>
          )}
          {it.sources.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {uniqueSources(it.sources).map((s, i) => (
                <SourceChip key={i} label={s.label} href={s.url} />
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Panel({
  id,
  title,
  intro,
  items,
  empty,
}: {
  id: string;
  title: string;
  intro: string;
  items: UnquantifiedItem[];
  empty: string;
}) {
  return (
    <article
      aria-labelledby={`${id}-t`}
      data-testid={id}
      className="hatch flex flex-col gap-4 rounded-lg border-[1.5px] border-dashed border-[var(--tier-announced-bd)] bg-surface p-5 sm:p-6"
    >
      <header className="space-y-1.5 rounded-md bg-surface px-3.5 py-3">
        <h5 id={`${id}-t`} className="flex items-center gap-2 text-lg font-semibold text-ink">
          <IconAnnounced size={18} className="shrink-0 text-ink-2" />
          {title}
          <span className="ms-auto rounded-full border border-rule-strong bg-surface px-2 py-0.5 text-xs font-semibold text-ink-2">
            {items.length}
          </span>
        </h5>
        <p className="text-sm text-ink-2">{intro}</p>
      </header>
      {items.length === 0 ? (
        <p className="rounded-md bg-surface px-3 py-2 text-sm text-ink-2">{empty}</p>
      ) : (
        <>
          <ItemList items={items.slice(0, VISIBLE)} />
          {items.length > VISIBLE && (
            <details className="group rounded-md border border-rule bg-surface">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 text-sm font-semibold text-ink marker:content-none hover:text-accent [&::-webkit-details-marker]:hidden">
                <span>Voir les {items.length - VISIBLE} autres éléments</span>
                <IconChevron
                  size={18}
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="px-2 pb-2">
                <ItemList items={items.slice(VISIBLE)} />
              </div>
            </details>
          )}
        </>
      )}
    </article>
  );
}
